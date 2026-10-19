//! Structural scan of JSON that has ALREADY passed serde_json validation.
//! Leaves borrow source tokens; keys without escapes borrow source strings.
//! All indexing remains checked and invalid structural states return errors.
use std::borrow::Cow;

pub enum Node<'a> {
    Scalar(&'a str),
    Array(Vec<Node<'a>>),
    Object(Vec<Member<'a>>),
}
pub struct Member<'a> {
    pub key: Cow<'a, str>,
    pub token: &'a str,
    pub value: Node<'a>,
}

/// Allocation-free nesting check, for selection without building a token tree.
/// The whole input must already have passed serde validation.
pub fn validate_depth(text: &str, max_depth: usize) -> Result<(), String> {
    let mut cursor = Cursor { text, pos: 0 };
    let mut depth = 0;
    while let Some(&byte) = text.as_bytes().get(cursor.pos) {
        match byte {
            b'"' => {
                cursor.string()?;
                continue;
            }
            b'{' | b'[' => {
                depth += 1;
                if depth > max_depth {
                    return Err("JSON nesting limit exceeded".into());
                }
            }
            b'}' | b']' => {
                depth -= 1;
            }
            _ => {}
        }
        cursor.pos += 1;
    }
    Ok(())
}

pub fn parse(text: &str, max_depth: usize) -> Result<Node<'_>, String> {
    let mut cursor = Cursor { text, pos: 0 };
    let result = cursor.value(0, max_depth)?;
    cursor.whitespace();
    if cursor.pos != text.len() {
        return Err("Unexpected trailing JSON content".into());
    }
    Ok(result)
}

struct Cursor<'a> {
    text: &'a str,
    pos: usize,
}
impl<'a> Cursor<'a> {
    fn whitespace(&mut self) {
        while self
            .text
            .as_bytes()
            .get(self.pos)
            .is_some_and(u8::is_ascii_whitespace)
        {
            self.pos += 1;
        }
    }
    fn expect(&mut self, byte: u8) -> Result<(), String> {
        self.whitespace();
        if self.text.as_bytes().get(self.pos) != Some(&byte) {
            return Err("Unexpected JSON delimiter".into());
        }
        self.pos += 1;
        Ok(())
    }
    fn string(&mut self) -> Result<&'a str, String> {
        self.expect(b'"')?;
        let start = self.pos - 1;
        // memchr scans Unicode/long strings without decoding or allocating.
        loop {
            let tail = self
                .text
                .as_bytes()
                .get(self.pos..)
                .ok_or("Unterminated JSON string")?;
            let offset = memchr::memchr2(b'"', b'\\', tail).ok_or("Unterminated JSON string")?;
            self.pos += offset;
            if self.text.as_bytes()[self.pos] == b'"' {
                self.pos += 1;
                return self
                    .text
                    .get(start..self.pos)
                    .ok_or_else(|| "Invalid JSON string span".into());
            }
            self.pos += 2; // validated escape: skip backslash and next ASCII byte
        }
    }
    fn value(&mut self, depth: usize, max_depth: usize) -> Result<Node<'a>, String> {
        self.whitespace();
        let start = self.pos;
        let byte = *self
            .text
            .as_bytes()
            .get(start)
            .ok_or("Missing JSON value")?;
        if byte == b'{' || byte == b'[' {
            if depth >= max_depth {
                return Err("JSON nesting limit exceeded".into());
            }
            self.pos += 1;
            self.whitespace();
            let end = if byte == b'{' { b'}' } else { b']' };
            let mut array = Vec::new();
            let mut members = Vec::new();
            if self.text.as_bytes().get(self.pos) == Some(&end) {
                self.pos += 1;
            } else {
                loop {
                    if byte == b'{' {
                        let token = self.string()?;
                        let key = if token.as_bytes().contains(&b'\\') {
                            Cow::Owned(
                                serde_json::from_str::<String>(token).map_err(|e| e.to_string())?,
                            )
                        } else {
                            Cow::Borrowed(&token[1..token.len() - 1])
                        };
                        self.expect(b':')?;
                        members.push(Member {
                            key,
                            token,
                            value: self.value(depth + 1, max_depth)?,
                        });
                    } else {
                        array.push(self.value(depth + 1, max_depth)?);
                    }
                    self.whitespace();
                    if self.text.as_bytes().get(self.pos) == Some(&end) {
                        self.pos += 1;
                        break;
                    }
                    self.expect(b',')?;
                }
            }
            if byte == b'[' {
                return Ok(Node::Array(array));
            }
            members.sort_unstable_by(|a, b| a.key.encode_utf16().cmp(b.key.encode_utf16()));
            if members.windows(2).any(|pair| pair[0].key == pair[1].key) {
                return Err("Duplicate decoded object key".into());
            }
            return Ok(Node::Object(members));
        }
        if byte == b'"' {
            return self.string().map(Node::Scalar);
        }
        while self
            .text
            .as_bytes()
            .get(self.pos)
            .is_some_and(|b| !b.is_ascii_whitespace() && !b",]}".contains(b))
        {
            self.pos += 1;
        }
        let token = self
            .text
            .get(start..self.pos)
            .ok_or("Invalid JSON scalar span")?;
        if token.is_empty() {
            return Err("Missing JSON scalar".into());
        }
        Ok(Node::Scalar(token))
    }
}
