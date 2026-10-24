use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ErrorKind {
    Syntax(&'static str),
    UnexpectedEnd,
    InvalidUtf8,
    DepthLimit,
    InputLimit,
    OutputLimit,
    DuplicateKey,
    LoneSurrogate,
    NumberOutOfRange,
    PrecisionLoss,
    InvalidLimit,
}

impl ErrorKind {
    /// Stable identifier exposed to JavaScript as `error.code`.
    #[must_use]
    pub fn code(self) -> &'static str {
        match self {
            Self::Syntax(_) | Self::UnexpectedEnd => "ERR_JSON_SYNTAX",
            Self::InvalidUtf8 => "ERR_JSON_ENCODING",
            Self::DepthLimit => "ERR_JSON_DEPTH",
            Self::InputLimit | Self::OutputLimit => "ERR_JSON_SIZE",
            Self::DuplicateKey => "ERR_JSON_DUPLICATE_KEY",
            Self::LoneSurrogate => "ERR_JSON_LONE_SURROGATE",
            Self::NumberOutOfRange => "ERR_JSON_NUMBER_RANGE",
            Self::PrecisionLoss => "ERR_JSON_PRECISION",
            Self::InvalidLimit => "ERR_JSON_INVALID_LIMIT",
        }
    }
}

impl fmt::Display for ErrorKind {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Syntax(message) => f.write_str(message),
            Self::UnexpectedEnd => f.write_str("unexpected end of JSON input"),
            Self::InvalidUtf8 => f.write_str("input is not valid UTF-8"),
            Self::DepthLimit => f.write_str("nesting depth limit exceeded"),
            Self::InputLimit => f.write_str("input byte limit exceeded"),
            Self::OutputLimit => f.write_str("output byte limit exceeded"),
            Self::DuplicateKey => f.write_str("duplicate object key"),
            Self::LoneSurrogate => f.write_str("string contains a lone UTF-16 surrogate"),
            Self::NumberOutOfRange => f.write_str("number is outside the IEEE 754 double range"),
            Self::PrecisionLoss => {
                f.write_str("number would change value when canonicalized as an IEEE 754 double")
            }
            Self::InvalidLimit => f.write_str("limit is out of range"),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Error {
    pub kind: ErrorKind,
    /// Byte offset into the input.
    pub offset: usize,
}

impl Error {
    pub(crate) fn new(kind: ErrorKind, offset: usize) -> Self {
        Self { kind, offset }
    }

    /// One-based line and UTF-16 column of the error, matching what an editor shows.
    /// `\n`, `\r\n` and a bare `\r` each end a line.
    #[must_use]
    pub fn locate(&self, input: &[u8]) -> (usize, usize) {
        let end = self.offset.min(input.len());
        let before = &input[..end];
        let mut line = 1;
        let mut line_start = 0;
        for (i, &b) in before.iter().enumerate() {
            let breaks = b == b'\n' || (b == b'\r' && input.get(i + 1) != Some(&b'\n'));
            if breaks {
                line += 1;
                line_start = i + 1;
            }
        }
        let column = 1 + before[line_start..]
            .iter()
            .filter(|&&b| b & 0xC0 != 0x80)
            .map(|&b| if b >= 0xF0 { 2 } else { 1 })
            .sum::<usize>();
        (line, column)
    }
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{} at byte {}", self.kind, self.offset)
    }
}

impl std::error::Error for Error {}
