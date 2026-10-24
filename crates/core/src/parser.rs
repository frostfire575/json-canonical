//! Single-pass validating parser that writes its output while it reads.
//!
//! Sorting does not build a tree. Each object member is written to the output
//! as it is parsed and remembered as a byte span. When the object closes, its
//! spans are checked for order. Members that are already sorted, which is common
//! for machine-written JSON, cost nothing more. Otherwise the object records a
//! patch: its body range plus the member spans in sorted order. Nothing moves
//! until the end, when one pass copies every byte once with the patches applied.
//! Moving bytes at each level instead made deep unsorted nesting cost
//! O(size * depth): 1 s for a 4 MB value under 1000 unsorted levels.

use crate::Limits;
use crate::error::{Error, ErrorKind};
use crate::number;
use crate::text::{cmp_utf16, decode_units, hex4, simple_escape, skip_plain};
use std::cmp::Ordering;

#[derive(Clone, Copy, PartialEq, Eq)]
pub(crate) enum Mode {
    Validate,
    Minify,
    Sort,
    Canonical,
}

pub(crate) struct Segment<'p> {
    pub key: &'p str,
    pub index: Option<usize>,
}

#[derive(Clone, Copy)]
struct Token {
    start: usize,
    end: usize,
    escaped: bool,
}

/// An object whose members must be emitted in a different order.
struct Patch {
    /// Output range of the body between the braces.
    body: (usize, usize),
    /// Range in `order` holding the member spans, sorted.
    members: (usize, usize),
}

struct Member {
    /// Key body inside the source, without quotes.
    key: (usize, usize),
    /// Range in `units` holding the decoded key when it contains escapes.
    units: Option<(usize, usize)>,
    /// Source offset of the key, for error reporting.
    at: usize,
    span: (usize, usize),
}

pub(crate) struct Parser<'a, 'p> {
    src: &'a str,
    bytes: &'a [u8],
    pos: usize,
    mode: Mode,
    limits: Limits,
    strict_numbers: bool,
    pub out: String,
    members: Vec<Member>,
    units: Vec<u16>,
    patches: Vec<Patch>,
    order: Vec<(usize, usize)>,
    digits: String,
    shortest: String,
    path: &'p [Segment<'p>],
    pub selected: Option<(usize, usize)>,
}

impl<'a, 'p> Parser<'a, 'p> {
    pub fn new(src: &'a str, mode: Mode, limits: Limits, strict_numbers: bool) -> Self {
        let capacity = if mode == Mode::Validate { 0 } else { src.len() };
        Self {
            src,
            bytes: src.as_bytes(),
            pos: 0,
            mode,
            limits,
            strict_numbers,
            out: String::with_capacity(capacity),
            members: Vec::new(),
            units: Vec::new(),
            patches: Vec::new(),
            order: Vec::new(),
            digits: String::new(),
            shortest: String::new(),
            path: &[],
            selected: None,
        }
    }

    pub fn with_path(mut self, path: &'p [Segment<'p>]) -> Self {
        self.path = path;
        self
    }

    pub fn run(&mut self) -> Result<(), Error> {
        if self.bytes.len() > self.limits.max_bytes {
            return Err(Error::new(ErrorKind::InputLimit, self.limits.max_bytes));
        }
        let root = (self.mode == Mode::Validate).then_some(0);
        self.value(0, root)?;
        self.skip_ws();
        if self.pos != self.bytes.len() {
            return Err(self.error(ErrorKind::Syntax("unexpected content after JSON value")));
        }
        if !self.patches.is_empty() {
            self.patches.sort_unstable_by_key(|p| p.body.0);
            let mut sorted = String::with_capacity(self.out.len());
            apply(
                &self.out,
                &self.patches,
                &self.order,
                (0, self.out.len()),
                &mut sorted,
            );
            self.out = sorted;
        }
        Ok(())
    }

    fn error(&self, kind: ErrorKind) -> Error {
        Error::new(kind, self.pos)
    }

    fn syntax(&self, message: &'static str) -> Error {
        if self.pos >= self.bytes.len() {
            self.error(ErrorKind::UnexpectedEnd)
        } else {
            self.error(ErrorKind::Syntax(message))
        }
    }

    #[inline]
    fn peek(&self) -> Option<u8> {
        self.bytes.get(self.pos).copied()
    }

    #[inline]
    fn skip_ws(&mut self) {
        while let Some(b' ' | b'\t' | b'\n' | b'\r') = self.peek() {
            self.pos += 1;
        }
    }

    #[inline]
    fn emits(&self) -> bool {
        self.mode != Mode::Validate
    }

    #[inline]
    fn push(&mut self, c: char) {
        if self.emits() {
            self.out.push(c);
        }
    }

    /// `level` is `Some(i)` while this value sits on the selection path with the
    /// first `i` segments matched.
    fn value(&mut self, depth: u32, level: Option<usize>) -> Result<(), Error> {
        self.skip_ws();
        let start = self.pos;
        let target = level == Some(self.path.len());
        let inner = if target { None } else { level };
        match self.peek() {
            Some(b'{') => self.object(depth, inner)?,
            Some(b'[') => self.array(depth, inner)?,
            Some(b'"') => {
                let token = self.scan_string()?;
                self.write_string(token)?;
            }
            Some(b'-' | b'0'..=b'9') => self.number()?,
            Some(b't') => self.literal("true")?,
            Some(b'f') => self.literal("false")?,
            Some(b'n') => self.literal("null")?,
            _ => return Err(self.syntax("expected a JSON value")),
        }
        if target {
            self.selected = Some((start, self.pos));
        }
        Ok(())
    }

    fn literal(&mut self, word: &'static str) -> Result<(), Error> {
        let end = self.pos + word.len();
        if self.bytes.get(self.pos..end) != Some(word.as_bytes()) {
            return Err(self.syntax("invalid literal"));
        }
        self.pos = end;
        if self.emits() {
            self.out.push_str(word);
        }
        Ok(())
    }

    fn enter(&self, depth: u32) -> Result<u32, Error> {
        if depth >= self.limits.max_depth {
            return Err(self.error(ErrorKind::DepthLimit));
        }
        Ok(depth + 1)
    }

    fn array(&mut self, depth: u32, level: Option<usize>) -> Result<(), Error> {
        let depth = self.enter(depth)?;
        self.pos += 1;
        self.push('[');
        self.skip_ws();
        if self.peek() == Some(b']') {
            self.pos += 1;
            self.push(']');
            return Ok(());
        }
        let mut index = 0;
        loop {
            let child = match level {
                Some(l) if self.path.get(l).is_some_and(|s| s.index == Some(index)) => Some(l + 1),
                _ => None,
            };
            self.value(depth, child)?;
            self.skip_ws();
            match self.peek() {
                Some(b',') => {
                    self.pos += 1;
                    self.push(',');
                    index += 1;
                }
                Some(b']') => {
                    self.pos += 1;
                    self.push(']');
                    return Ok(());
                }
                _ => return Err(self.syntax("expected ',' or ']' in array")),
            }
        }
    }

    fn object(&mut self, depth: u32, level: Option<usize>) -> Result<(), Error> {
        let depth = self.enter(depth)?;
        let reorder = matches!(self.mode, Mode::Sort | Mode::Canonical);
        self.pos += 1;
        self.push('{');
        let body = self.out.len();
        let members = self.members.len();
        let units = self.units.len();
        self.skip_ws();
        if self.peek() == Some(b'}') {
            self.pos += 1;
            self.push('}');
            return Ok(());
        }
        loop {
            self.skip_ws();
            if self.peek() != Some(b'"') {
                return Err(self.syntax("expected a string key"));
            }
            let at = self.pos;
            let key = self.scan_string()?;
            let child = match level {
                Some(l) if self.path.get(l).is_some_and(|s| self.key_is(key, s.key)) => {
                    // JSON.parse keeps the last duplicate, so a later match replaces any
                    // selection made inside an earlier one.
                    self.selected = None;
                    Some(l + 1)
                }
                _ => None,
            };
            let start = self.out.len();
            self.write_string(key)?;
            self.skip_ws();
            if self.peek() != Some(b':') {
                return Err(self.syntax("expected ':' after object key"));
            }
            self.pos += 1;
            self.push(':');
            self.value(depth, child)?;
            if reorder {
                let decoded = key.escaped.then(|| {
                    let from = self.units.len();
                    decode_units(&self.src[key.start + 1..key.end - 1], &mut self.units);
                    (from, self.units.len())
                });
                self.members.push(Member {
                    key: (key.start + 1, key.end - 1),
                    units: decoded,
                    at,
                    span: (start, self.out.len()),
                });
            }
            self.skip_ws();
            match self.peek() {
                Some(b',') => {
                    self.pos += 1;
                    self.push(',');
                }
                Some(b'}') => {
                    self.pos += 1;
                    break;
                }
                _ => return Err(self.syntax("expected ',' or '}' in object")),
            }
        }
        if reorder {
            self.reorder(members, body)?;
            self.members.truncate(members);
            self.units.truncate(units);
        }
        self.push('}');
        Ok(())
    }

    fn key_is(&self, key: Token, segment: &str) -> bool {
        let body = &self.src[key.start + 1..key.end - 1];
        if !key.escaped {
            return body == segment;
        }
        let mut units = Vec::with_capacity(body.len());
        decode_units(body, &mut units);
        units.iter().copied().eq(segment.encode_utf16())
    }

    fn reorder(&mut self, from: usize, body: usize) -> Result<(), Error> {
        let Self {
            src,
            members,
            units,
            out,
            patches,
            order,
            ..
        } = self;
        let (src, units): (&str, &[u16]) = (src, units);
        let members = &mut members[from..];
        let compare = |a: &Member, b: &Member| compare_keys(src, units, a, b);
        let duplicate =
            |a: &Member, b: &Member| Error::new(ErrorKind::DuplicateKey, a.at.max(b.at));
        let mut sorted = true;
        for pair in members.windows(2) {
            match compare(&pair[0], &pair[1]) {
                Ordering::Less => {}
                Ordering::Equal => return Err(duplicate(&pair[0], &pair[1])),
                Ordering::Greater => {
                    sorted = false;
                    break;
                }
            }
        }
        if sorted {
            return Ok(());
        }
        members.sort_unstable_by(compare);
        if let Some(error) = members.windows(2).find_map(|pair| match pair {
            [a, b] if compare(a, b) == Ordering::Equal => Some(duplicate(a, b)),
            _ => None,
        }) {
            return Err(error);
        }
        let first = order.len();
        order.extend(members.iter().map(|m| m.span));
        patches.push(Patch {
            body: (body, out.len()),
            members: (first, order.len()),
        });
        Ok(())
    }

    /// Validates a string token starting at the opening quote.
    fn scan_string(&mut self) -> Result<Token, Error> {
        let start = self.pos;
        self.pos += 1;
        let mut escaped = false;
        loop {
            self.pos += skip_plain(&self.bytes[self.pos..]);
            match self.peek() {
                Some(b'"') => {
                    self.pos += 1;
                    return Ok(Token {
                        start,
                        end: self.pos,
                        escaped,
                    });
                }
                Some(b'\\') => {
                    escaped = true;
                    match self.bytes.get(self.pos + 1) {
                        Some(&b) if simple_escape(b).is_some() => self.pos += 2,
                        Some(b'u') if hex4(&self.bytes[self.pos + 2..]).is_some() => self.pos += 6,
                        _ => return Err(self.syntax("invalid escape sequence")),
                    }
                }
                Some(b) if b < 0x20 => {
                    return Err(
                        self.error(ErrorKind::Syntax("unescaped control character in string"))
                    );
                }
                Some(_) => self.pos += 1,
                None => return Err(self.error(ErrorKind::UnexpectedEnd)),
            }
        }
    }

    fn write_string(&mut self, token: Token) -> Result<(), Error> {
        match self.mode {
            Mode::Validate => Ok(()),
            Mode::Canonical if token.escaped => self.write_canonical_string(token),
            _ => {
                self.out.push_str(&self.src[token.start..token.end]);
                Ok(())
            }
        }
    }

    /// RFC 8785 section 3.2.2.2: decode, then escape only what JSON requires.
    fn write_canonical_string(&mut self, token: Token) -> Result<(), Error> {
        let bytes = self.bytes;
        let mut i = token.start + 1;
        let end = token.end - 1;
        let mut run = i;
        self.out.push('"');
        while i < end {
            if bytes[i] != b'\\' {
                i += 1;
                continue;
            }
            self.out.push_str(&self.src[run..i]);
            let at = i;
            let unit = if let Some(unit) = simple_escape(bytes[i + 1]) {
                i += 2;
                unit
            } else {
                i += 6;
                hex4(&bytes[at + 2..]).unwrap_or(0)
            };
            let c = match unit {
                0xD800..=0xDBFF => {
                    let low = (bytes.get(i..i + 2) == Some(b"\\u"))
                        .then(|| hex4(&bytes[i + 2..]))
                        .flatten()
                        .filter(|low| (0xDC00..=0xDFFF).contains(low));
                    let Some(low) = low else {
                        return Err(Error::new(ErrorKind::LoneSurrogate, at));
                    };
                    i += 6;
                    let scalar =
                        0x10000 + ((u32::from(unit) - 0xD800) << 10) + (u32::from(low) - 0xDC00);
                    char::from_u32(scalar)
                }
                0xDC00..=0xDFFF => None,
                _ => char::from_u32(u32::from(unit)),
            };
            let Some(c) = c else {
                return Err(Error::new(ErrorKind::LoneSurrogate, at));
            };
            write_escaped(&mut self.out, c);
            run = i;
        }
        self.out.push_str(&self.src[run..end]);
        self.out.push('"');
        Ok(())
    }

    fn number(&mut self) -> Result<(), Error> {
        let start = self.pos;
        if self.peek() == Some(b'-') {
            self.pos += 1;
        }
        match self.peek() {
            Some(b'0') => self.pos += 1,
            Some(b'1'..=b'9') => self.digits(),
            _ => return Err(self.syntax("invalid number")),
        }
        let integer = self.pos;
        if self.peek() == Some(b'.') {
            self.pos += 1;
            if !self.peek().is_some_and(|b| b.is_ascii_digit()) {
                return Err(self.syntax("expected digit after decimal point"));
            }
            self.digits();
        }
        if let Some(b'e' | b'E') = self.peek() {
            self.pos += 1;
            if let Some(b'+' | b'-') = self.peek() {
                self.pos += 1;
            }
            if !self.peek().is_some_and(|b| b.is_ascii_digit()) {
                return Err(self.syntax("expected digit in exponent"));
            }
            self.digits();
        }
        let token = &self.src[start..self.pos];
        match self.mode {
            Mode::Validate => {}
            Mode::Minify | Mode::Sort => self.out.push_str(token),
            Mode::Canonical => {
                let plain = integer == self.pos;
                let digits = integer - start - usize::from(token.starts_with('-'));
                if plain && digits <= 15 {
                    // Integers below 10^15 are exact doubles and already in canonical form.
                    self.out.push_str(if token == "-0" { "0" } else { token });
                } else {
                    self.canonical_number(token, start)?;
                }
            }
        }
        Ok(())
    }

    fn canonical_number(&mut self, token: &str, at: usize) -> Result<(), Error> {
        number::write_canonical(
            token,
            self.strict_numbers,
            &mut self.out,
            &mut self.digits,
            &mut self.shortest,
        )
        .map_err(|kind| Error::new(kind, at))?;
        if self.out.len() > self.limits.max_bytes {
            return Err(Error::new(ErrorKind::OutputLimit, at));
        }
        Ok(())
    }

    #[inline]
    fn digits(&mut self) {
        while self.peek().is_some_and(|b| b.is_ascii_digit()) {
            self.pos += 1;
        }
    }
}

/// Copies `out[range]` into `dst`, emitting each patched object's members in sorted
/// order. Patches are sorted by start; those nested in a patch are reached through
/// its members, so every byte is copied exactly once.
fn apply(
    out: &str,
    patches: &[Patch],
    order: &[(usize, usize)],
    range: (usize, usize),
    dst: &mut String,
) {
    let (mut pos, end) = range;
    let mut next = patches.partition_point(|p| p.body.0 <= pos);
    while let Some(patch) = patches.get(next).filter(|p| p.body.0 < end) {
        dst.push_str(&out[pos..patch.body.0]);
        for (i, &span) in order[patch.members.0..patch.members.1].iter().enumerate() {
            if i > 0 {
                dst.push(',');
            }
            apply(out, patches, order, span, dst);
        }
        pos = patch.body.1;
        next = patches.partition_point(|p| p.body.0 <= pos);
    }
    dst.push_str(&out[pos..end]);
}

fn compare_keys(src: &str, units: &[u16], a: &Member, b: &Member) -> Ordering {
    let body = |m: &Member| &src[m.key.0..m.key.1];
    match (a.units, b.units) {
        (None, None) => cmp_utf16(body(a).as_bytes(), body(b).as_bytes()),
        (Some(x), Some(y)) => units[x.0..x.1].cmp(&units[y.0..y.1]),
        (Some(x), None) => units[x.0..x.1].iter().copied().cmp(body(b).encode_utf16()),
        (None, Some(y)) => body(a).encode_utf16().cmp(units[y.0..y.1].iter().copied()),
    }
}

fn write_escaped(out: &mut String, c: char) {
    match c {
        '"' => out.push_str("\\\""),
        '\\' => out.push_str("\\\\"),
        '\u{8}' => out.push_str("\\b"),
        '\u{c}' => out.push_str("\\f"),
        '\n' => out.push_str("\\n"),
        '\r' => out.push_str("\\r"),
        '\t' => out.push_str("\\t"),
        c if u32::from(c) < 0x20 => {
            const HEX: &[u8; 16] = b"0123456789abcdef";
            let v = u32::from(c) as usize;
            out.push_str("\\u00");
            out.push(char::from(HEX[v >> 4]));
            out.push(char::from(HEX[v & 15]));
        }
        c => out.push(c),
    }
}
