//! Choose a lossless Node string representation after serialization.
//!
//! Dense non-ASCII UTF8 output is expensive for napi_create_string_utf8 on the
//! measured V8 version. Convert it once in Rust and use the UTF16 Node-API path.
//! Short, ASCII and sparse Unicode outputs retain the cheaper original route.
use napi::bindgen_prelude::{Either, Utf16String};

pub type Output = Either<String, Utf16String>;

pub fn encode(output: String) -> Output {
    // Bound routing work to 1024 bytes, even for multi-megabyte ASCII output.
    // Four distributed samples avoid favoring an isolated Unicode prefix/suffix.
    // This is an empirical heuristic, not a serialization rule. Both routes
    // preserve every code unit, including backslash escapes in raw JSON tokens.
    if output.len() >= 1024
        && (0..4).all(|index| {
            let start = index * (output.len() - 256) / 3;
            output.as_bytes()[start..start + 256]
                .iter()
                .filter(|byte| !byte.is_ascii())
                .count()
                >= 32
        })
    {
        Either::B(output.into())
    } else {
        Either::A(output)
    }
}
