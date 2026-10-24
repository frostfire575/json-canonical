//! RFC 8785 number serialization: ECMAScript `Number.prototype.toString` on the
//! nearest IEEE 754 double.

use crate::error::ErrorKind;
use std::fmt::Write;

/// Significant digits of a grammar-checked JSON number token, written to `digits`
/// without leading or trailing zeros. Returns the sign and the decimal point
/// position `n`, where the value is `0.d1d2...dk * 10^n`.
fn decimal(token: &str, digits: &mut String) -> (bool, i64) {
    let negative = token.starts_with('-');
    let token = token.strip_prefix('-').unwrap_or(token);
    let (mantissa, exponent) = match token.find(['e', 'E']) {
        Some(i) => (&token[..i], parse_exponent(&token[i + 1..])),
        None => (token, 0),
    };
    let (int, frac) = mantissa.split_once('.').unwrap_or((mantissa, ""));
    digits.clear();
    digits.push_str(int);
    digits.push_str(frac);
    let leading = digits.bytes().take_while(|&b| b == b'0').count();
    digits.drain(..leading);
    let significant = digits.trim_end_matches('0').len();
    digits.truncate(significant);
    let point = i64::try_from(int.len())
        .unwrap_or(i64::MAX)
        .saturating_add(exponent)
        .saturating_sub(i64::try_from(leading).unwrap_or(0));
    (negative, point)
}

/// Shortest round-trip digits of finite non-zero `v`, and their point position.
fn shortest(v: f64, digits: &mut String) -> i64 {
    digits.clear();
    let _ = write!(digits, "{:e}", v.abs());
    let k = digits
        .bytes()
        .take_while(|&b| b != b'e')
        .filter(u8::is_ascii_digit)
        .count();
    // `{:e}` finds the shortest round-trip length k, but among k-digit candidates it
    // does not always pick the closest (113017829008754.13 instead of .12), which
    // ECMA-262 requires. Below 16 digits in the normal range only one k-digit
    // candidate exists (DBL_DIG is 15), so the check can be skipped there.
    if k >= 16 || v.abs() < f64::MIN_POSITIVE {
        closest(v.abs(), k, digits);
    }
    let e = digits.find('e').unwrap_or(digits.len());
    let exponent: i64 = digits[e + 1..].parse().unwrap_or(0);
    digits.truncate(e);
    digits.retain(|c| c != '.');
    let significant = digits.trim_end_matches('0').len().max(1);
    digits.truncate(significant);
    exponent + 1
}

/// Replaces `digits` (the `{:e}` form of `v`, k digits) with the closest k-digit
/// decimal that still rounds to `v`, in `{:e}` form.
///
/// The decimal correctly rounded to k digits is the closest one, but at a power of
/// two the rounding interval is lopsided and it can fall outside (2^-24 rounds to
/// ...062e-8, which parses to a different double; V8 prints ...063e-8). Then the
/// closest valid one is its neighbour on the wide side.
fn closest(v: f64, k: usize, digits: &mut String) {
    // Away from powers of two the interval is symmetric around v, so the correctly
    // rounded decimal, being closer than the k-digit one `{:e}` found, lies inside.
    if v.to_bits() & ((1 << 52) - 1) != 0 {
        digits.clear();
        let _ = write!(digits, "{:.*e}", k - 1, v);
        return;
    }
    let mut rounded = String::new();
    let _ = write!(rounded, "{:.*e}", k - 1, v);
    let Some((mantissa, exponent)) = rounded.split_once('e') else {
        return;
    };
    let (Ok(m), Ok(exponent)) = (
        mantissa.replace('.', "").parse::<u64>(),
        exponent.parse::<i64>(),
    ) else {
        return;
    };
    let scale = exponent - i64::try_from(k).unwrap_or(0) + 1;
    let round_trips = |m: u64| format!("{m}e{scale}").parse::<f64>() == Ok(v);
    let Some(m) = [Some(m), m.checked_sub(1), m.checked_add(1)]
        .into_iter()
        .flatten()
        .find(|&m| round_trips(m))
    else {
        return;
    };
    let text = m.to_string();
    digits.clear();
    let _ = write!(
        digits,
        "{}.{}e{}",
        &text[..1],
        &text[1..],
        scale + i64::try_from(text.len()).unwrap_or(0) - 1
    );
}

fn write_digits(negative: bool, digits: &str, n: i64, out: &mut String) {
    let k = i64::try_from(digits.len()).unwrap_or(i64::MAX);
    if negative {
        out.push('-');
    }
    if k <= n && n <= 21 {
        out.push_str(digits);
        out.extend(std::iter::repeat_n(
            '0',
            usize::try_from(n - k).unwrap_or(0),
        ));
    } else if 0 < n && n <= 21 {
        let point = usize::try_from(n).unwrap_or(0);
        out.push_str(&digits[..point]);
        out.push('.');
        out.push_str(&digits[point..]);
    } else if -6 < n && n <= 0 {
        out.push_str("0.");
        out.extend(std::iter::repeat_n('0', usize::try_from(-n).unwrap_or(0)));
        out.push_str(digits);
    } else {
        out.push_str(&digits[..1]);
        if k > 1 {
            out.push('.');
            out.push_str(&digits[1..]);
        }
        let _ = write!(out, "e{}{}", if n > 0 { '+' } else { '-' }, (n - 1).abs());
    }
}

/// Appends the RFC 8785 form of a grammar-checked JSON number token. With `strict`,
/// fails when the nearest double is not exactly the written decimal value.
pub(crate) fn write_canonical(
    token: &str,
    strict: bool,
    out: &mut String,
    digits: &mut String,
    scratch: &mut String,
) -> Result<(), ErrorKind> {
    let (negative, point) = decimal(token, digits);
    if digits.is_empty() {
        out.push('0');
        return Ok(());
    }
    // Distinct decimals of at most 15 significant digits map to distinct normal
    // doubles, so such a token already is the unique shortest form and needs no
    // float parsing or formatting. The range stays clear of subnormals and overflow.
    if digits.len() <= 15 && (-306..=308).contains(&point) {
        write_digits(negative, digits, point, out);
        return Ok(());
    }
    let value: f64 = token.parse().map_err(|_| ErrorKind::NumberOutOfRange)?;
    if !value.is_finite() {
        return Err(ErrorKind::NumberOutOfRange);
    }
    if value == 0.0 {
        if strict {
            return Err(ErrorKind::PrecisionLoss);
        }
        out.push('0');
        return Ok(());
    }
    let n = shortest(value, scratch);
    if strict && (n != point || scratch != digits) {
        return Err(ErrorKind::PrecisionLoss);
    }
    write_digits(negative, scratch, n, out);
    Ok(())
}

fn parse_exponent(text: &str) -> i64 {
    let (negative, digits) = match text.as_bytes().first() {
        Some(b'-') => (true, &text[1..]),
        Some(b'+') => (false, &text[1..]),
        _ => (false, text),
    };
    let magnitude = digits.bytes().fold(0i64, |acc, b| {
        acc.saturating_mul(10).saturating_add(i64::from(b - b'0'))
    });
    if negative { -magnitude } else { magnitude }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn canonical(token: &str, strict: bool) -> Result<String, ErrorKind> {
        let (mut out, mut digits, mut scratch) = (String::new(), String::new(), String::new());
        write_canonical(token, strict, &mut out, &mut digits, &mut scratch).map(|()| out)
    }

    /// Spells `v` with 17 significant digits so the slow path runs.
    fn es(v: f64) -> String {
        canonical(&format!("{v:.16e}"), false).unwrap()
    }

    #[test]
    fn rfc8785_appendix_b() {
        let cases: [(u64, &str); 21] = [
            (0x0000_0000_0000_0000, "0"),
            (0x8000_0000_0000_0000, "0"),
            (0x0000_0000_0000_0001, "5e-324"),
            (0x8000_0000_0000_0001, "-5e-324"),
            (0x7fef_ffff_ffff_ffff, "1.7976931348623157e+308"),
            (0xffef_ffff_ffff_ffff, "-1.7976931348623157e+308"),
            (0x4340_0000_0000_0000, "9007199254740992"),
            (0xc340_0000_0000_0000, "-9007199254740992"),
            (0x4430_0000_0000_0000, "295147905179352830000"),
            (0x44b5_2d02_c7e1_4af5, "9.999999999999997e+22"),
            (0x44b5_2d02_c7e1_4af6, "1e+23"),
            (0x44b5_2d02_c7e1_4af7, "1.0000000000000001e+23"),
            (0x444b_1ae4_d6e2_ef4e, "999999999999999700000"),
            (0x444b_1ae4_d6e2_ef4f, "999999999999999900000"),
            (0x444b_1ae4_d6e2_ef50, "1e+21"),
            (0x3eb0_c6f7_a0b5_ed8c, "9.999999999999997e-7"),
            (0x3eb0_c6f7_a0b5_ed8d, "0.000001"),
            (0x41b3_de43_5555_5553, "333333333.3333332"),
            (0x41b3_de43_5555_5554, "333333333.33333325"),
            (0x41b3_de43_5555_5555, "333333333.3333333"),
            (0x41b3_de43_5555_5556, "333333333.3333334"),
        ];
        for (bits, expected) in cases {
            assert_eq!(es(f64::from_bits(bits)), expected, "{bits:#x}");
        }
    }

    #[test]
    fn closest_shortest_digits() {
        for text in ["113017829008754.12", "1940597577486187.2"] {
            assert_eq!(canonical(text, false).unwrap(), text);
        }
        // Powers of two, where correct rounding to k digits leaves the interval.
        for (v, expected) in [
            (2f64.powi(-24), "5.960464477539063e-8"),
            (2f64.powi(89), "6.189700196426902e+26"),
            (2f64.powi(-44), "5.684341886080802e-14"),
        ] {
            assert_eq!(es(v), expected);
            assert_eq!(expected.parse::<f64>(), Ok(v));
        }
    }

    #[test]
    fn fast_path_matches_slow_path() {
        for token in [
            "1.5",
            "-0.000123",
            "12345678901234.5",
            "1e21",
            "1e-7",
            "123e-310",
            "9.99e307",
            "5e-324",
            "1E+2",
        ] {
            let v: f64 = token.parse().unwrap();
            assert_eq!(canonical(token, false).unwrap(), es(v), "{token}");
        }
    }

    #[test]
    fn exactness() {
        for exact in [
            "0",
            "-0",
            "0.0e10",
            "1",
            "1.0",
            "100",
            "1e2",
            "0.1",
            "1.5e-7",
            "-12.50",
            "9007199254740992",
        ] {
            assert!(canonical(exact, true).is_ok(), "{exact}");
        }
        for lossy in [
            "9007199254740993",
            "0.10000000000000000001",
            "1e-400",
            "1.00000000000000000001",
            "4e-324",
        ] {
            assert_eq!(
                canonical(lossy, true),
                Err(ErrorKind::PrecisionLoss),
                "{lossy}"
            );
        }
        assert_eq!(canonical("1e400", false), Err(ErrorKind::NumberOutOfRange));
    }
}
