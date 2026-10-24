//! String token scanning, decoding and UTF-16 ordering.

use std::cmp::Ordering;

const ONES: u64 = 0x0101_0101_0101_0101;
const HIGH: u64 = 0x8080_8080_8080_8080;

/// True when any byte of `w` is `"`, `\` or below 0x20. May not say which.
#[inline]
fn has_special(w: u64) -> bool {
    let quote = w ^ (ONES * u64::from(b'"'));
    let slash = w ^ (ONES * u64::from(b'\\'));
    let zero = |x: u64| x.wrapping_sub(ONES) & !x;
    let control = w.wrapping_sub(ONES * 0x20) & !w;
    (zero(quote) | zero(slash) | control) & HIGH != 0
}

/// Number of leading bytes of `bytes` that are plain string content, skipped eight
/// at a time. The byte at the returned position (if any) still needs inspection.
#[inline]
pub(crate) fn skip_plain(bytes: &[u8]) -> usize {
    let mut skipped = 0;
    for chunk in bytes.as_chunks::<8>().0 {
        if has_special(u64::from_le_bytes(*chunk)) {
            break;
        }
        skipped += 8;
    }
    skipped
}

pub(crate) fn hex4(bytes: &[u8]) -> Option<u16> {
    let digits = bytes.get(..4)?;
    digits.iter().try_fold(0u16, |acc, &b| {
        let digit = match b {
            b'0'..=b'9' => b - b'0',
            b'a'..=b'f' => b - b'a' + 10,
            b'A'..=b'F' => b - b'A' + 10,
            _ => return None,
        };
        Some(acc << 4 | u16::from(digit))
    })
}

/// Code unit for a single-character escape such as `\n`; `None` for `\u` or invalid.
pub(crate) fn simple_escape(b: u8) -> Option<u16> {
    Some(match b {
        b'"' => 0x22,
        b'\\' => 0x5C,
        b'/' => 0x2F,
        b'b' => 0x08,
        b'f' => 0x0C,
        b'n' => 0x0A,
        b'r' => 0x0D,
        b't' => 0x09,
        _ => return None,
    })
}

/// Appends the UTF-16 code units of a validated string body (without quotes).
/// Lone surrogates are kept as-is, so this never fails.
pub(crate) fn decode_units(body: &str, out: &mut Vec<u16>) {
    let bytes = body.as_bytes();
    let mut run = 0;
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] != b'\\' {
            i += 1;
            continue;
        }
        out.extend(body[run..i].encode_utf16());
        let unit = simple_escape(bytes[i + 1]);
        if let Some(unit) = unit {
            out.push(unit);
            i += 2;
        } else {
            out.push(hex4(&bytes[i + 2..]).unwrap_or(0));
            i += 6;
        }
        run = i;
    }
    out.extend(body[run..].encode_utf16());
}

/// Orders UTF-8 strings by their UTF-16 code units without transcoding.
///
/// The orders only disagree when a supplementary character (UTF-8 lead byte
/// F0..F4, UTF-16 surrogates D800..DFFF) meets a character in E000..FFFF (lead
/// byte EE or EF). Equal prefixes keep the first differing byte char-aligned.
pub(crate) fn cmp_utf16(left: &[u8], right: &[u8]) -> Ordering {
    let shared = left.len().min(right.len());
    let Some(at) = left[..shared]
        .iter()
        .zip(&right[..shared])
        .position(|(l, r)| l != r)
    else {
        return left.len().cmp(&right.len());
    };
    let (l, r) = (left[at], right[at]);
    let bmp_high = |lead: u8| (0xEE..0xF0).contains(&lead);
    if l >= 0xF0 && bmp_high(r) {
        Ordering::Less
    } else if r >= 0xF0 && bmp_high(l) {
        Ordering::Greater
    } else {
        l.cmp(&r)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn special_detection_matches_bytewise() {
        let mut seed = 0x9E37_79B9_7F4A_7C15_u64;
        for _ in 0..200_000 {
            seed ^= seed << 13;
            seed ^= seed >> 7;
            seed ^= seed << 17;
            let bytes = seed.to_le_bytes();
            let expected = bytes.iter().any(|&b| b == b'"' || b == b'\\' || b < 0x20);
            assert_eq!(has_special(seed), expected, "{bytes:?}");
        }
        for b in 0..=255u8 {
            let w = u64::from_le_bytes([b'a', b'a', b'a', b, b'a', b'a', b'a', b'a']);
            assert_eq!(has_special(w), b == b'"' || b == b'\\' || b < 0x20, "{b}");
        }
    }

    #[test]
    fn utf16_order() {
        let samples = [
            "",
            "a",
            "ab",
            "b",
            "\u{7f}",
            "é",
            "\u{d7ff}",
            "\u{e000}",
            "\u{ffff}",
            "😀",
            "😀a",
            "\u{10000}",
            "\u{10ffff}",
        ];
        for a in samples {
            for b in samples {
                let expected = a.encode_utf16().cmp(b.encode_utf16());
                assert_eq!(
                    cmp_utf16(a.as_bytes(), b.as_bytes()),
                    expected,
                    "{a:?} {b:?}"
                );
            }
        }
    }

    #[test]
    fn decodes_escapes() {
        let mut units = Vec::new();
        decode_units(r"a\né\ud800\/x", &mut units);
        assert_eq!(units, [0x61, 0x0A, 0xE9, 0xD800, 0x2F, 0x78]);
    }
}
