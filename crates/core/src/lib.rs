//! JSON text engine. Every operation validates the whole input against RFC 8259
//! in the same single pass that produces its result.
//!
//! - [`canonicalize`]: RFC 8785 (JCS) output, for hashing and signatures.
//! - [`sort`]: recursively sorted keys, preserving every number and string token.
//! - [`minify`]: whitespace removed, order and tokens preserved.
//! - [`validate`] and [`select`]: checks and JSON Pointer lookup with no output.

mod error;
mod number;
mod parser;
mod text;

pub use error::{Error, ErrorKind};

use parser::{Mode, Parser, Segment};

pub const DEFAULT_MAX_DEPTH: u32 = 128;
/// Hard cap that keeps the recursive parser well inside a 1 MiB thread stack.
pub const MAX_DEPTH: u32 = 1024;
pub const DEFAULT_MAX_BYTES: usize = 64 * 1024 * 1024;
pub const MAX_BYTES: usize = 1024 * 1024 * 1024;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Limits {
    pub max_depth: u32,
    /// Applies to the input and to the output separately.
    pub max_bytes: usize,
}

impl Default for Limits {
    fn default() -> Self {
        Self {
            max_depth: DEFAULT_MAX_DEPTH,
            max_bytes: DEFAULT_MAX_BYTES,
        }
    }
}

impl Limits {
    pub fn new(max_depth: Option<u32>, max_bytes: Option<usize>) -> Result<Self, Error> {
        let limits = Self {
            max_depth: max_depth.unwrap_or(DEFAULT_MAX_DEPTH),
            max_bytes: max_bytes.unwrap_or(DEFAULT_MAX_BYTES),
        };
        if (1..=MAX_DEPTH).contains(&limits.max_depth)
            && (1..=MAX_BYTES).contains(&limits.max_bytes)
        {
            Ok(limits)
        } else {
            Err(Error::new(ErrorKind::InvalidLimit, 0))
        }
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct Options {
    pub limits: Limits,
    /// Reject numbers whose canonical form denotes a different decimal value than
    /// the token, such as integers above 2^53 that lose digits. Only affects
    /// [`canonicalize`].
    pub strict_numbers: bool,
}

/// Checks that bytes are UTF-8 so they can be handed to the text functions.
pub fn from_utf8(bytes: &[u8]) -> Result<&str, Error> {
    std::str::from_utf8(bytes).map_err(|e| Error::new(ErrorKind::InvalidUtf8, e.valid_up_to()))
}

fn transform(input: &str, mode: Mode, options: Options) -> Result<String, Error> {
    let mut parser = Parser::new(input, mode, options.limits, options.strict_numbers);
    parser.run()?;
    Ok(parser.out)
}

/// RFC 8785 JSON Canonicalization Scheme. Duplicate keys, lone surrogates and
/// numbers outside the double range are errors, as I-JSON requires.
pub fn canonicalize(input: &str, options: Options) -> Result<String, Error> {
    transform(input, Mode::Canonical, options)
}

/// Sorts object keys by UTF-16 code units at every level and removes whitespace.
/// Number and string tokens are copied verbatim, so `1.0` stays `1.0`.
/// Duplicate keys are errors because their order would be ambiguous.
pub fn sort(input: &str, options: Options) -> Result<String, Error> {
    transform(input, Mode::Sort, options)
}

pub fn minify(input: &str, options: Options) -> Result<String, Error> {
    transform(input, Mode::Minify, options)
}

pub fn validate(input: &str, limits: Limits) -> Result<(), Error> {
    Parser::new(input, Mode::Validate, limits, false).run()
}

/// True when both documents have the same RFC 8785 canonical form.
pub fn equal(a: &str, b: &str, options: Options) -> Result<bool, Error> {
    Ok(canonicalize(a, options)? == canonicalize(b, options)?)
}

/// Returns the raw source text of the value at an already-unescaped JSON Pointer
/// path, after validating the whole document. Duplicate keys resolve to the last
/// occurrence, as `JSON.parse` does. `Ok(None)` means the path does not exist.
pub fn select<'a, S: AsRef<str>>(
    input: &'a str,
    path: &[S],
    limits: Limits,
) -> Result<Option<&'a str>, Error> {
    let segments: Vec<Segment<'_>> = path
        .iter()
        .map(|s| {
            let key = s.as_ref();
            let canonical_index = key == "0" || (!key.starts_with('0') && !key.is_empty());
            let index = (canonical_index && key.bytes().all(|b| b.is_ascii_digit()))
                .then(|| key.parse().ok())
                .flatten();
            Segment { key, index }
        })
        .collect();
    let mut parser = Parser::new(input, Mode::Validate, limits, false).with_path(&segments);
    parser.run()?;
    Ok(parser.selected.map(|(start, end)| &input[start..end]))
}

#[cfg(test)]
mod tests;
