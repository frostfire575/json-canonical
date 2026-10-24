use super::*;
use serde_json::Value;

fn opts() -> Options {
    Options::default()
}

fn canon(s: &str) -> Result<String, ErrorKind> {
    canonicalize(s, opts()).map_err(|e| e.kind)
}

#[test]
fn canonical_examples() {
    assert_eq!(
        canon(r#" { "b" : [1.0, 1e2, -0, 0.000001, 1e-7], "a": "\u00e9\n\/" } "#).unwrap(),
        "{\"a\":\"é\\n/\",\"b\":[1,100,0,0.000001,1e-7]}"
    );
    assert_eq!(
        canon(r#"{"\u20ac":1,"\r":2,"1":3,"\ud83d\ude00":4,"\ufb33":5,"\u0080":6,"ö":7}"#).unwrap(),
        "{\"\\r\":2,\"1\":3,\"\u{80}\":6,\"ö\":7,\"€\":1,\"😀\":4,\"\u{fb33}\":5}"
    );
    assert_eq!(
        canon(r#""\u001f\u007f\u2028""#).unwrap(),
        "\"\\u001f\u{7f}\u{2028}\""
    );
    assert_eq!(canon("123456789012345678").unwrap(), "123456789012345680");
    assert_eq!(canon(r#"{"a":1,"\u0061":2}"#), Err(ErrorKind::DuplicateKey));
    assert_eq!(canon(r#"["\ud800"]"#), Err(ErrorKind::LoneSurrogate));
    assert_eq!(canon(r#"["\udc00\ud800"]"#), Err(ErrorKind::LoneSurrogate));
    assert_eq!(canon("1e400"), Err(ErrorKind::NumberOutOfRange));
    let strict = Options {
        strict_numbers: true,
        ..opts()
    };
    assert_eq!(
        canonicalize("9007199254740993", strict).map_err(|e| e.kind),
        Err(ErrorKind::PrecisionLoss)
    );
    assert_eq!(
        canonicalize("[9007199254740992, 0.1, 1.50]", strict).unwrap(),
        "[9007199254740992,0.1,1.5]"
    );
}

#[test]
fn sort_preserves_tokens() {
    let input = r#"{"z":{"y":1.00,"x":"\u0041"},"\u0061":-0,"b":[3,{"d":1e+30,"c":true}]}"#;
    assert_eq!(
        sort(input, opts()).unwrap(),
        r#"{"\u0061":-0,"b":[3,{"c":true,"d":1e+30}],"z":{"x":"\u0041","y":1.00}}"#
    );
    assert_eq!(
        sort(r#"{"a":1,"\u0061":2}"#, opts()).unwrap_err().kind,
        ErrorKind::DuplicateKey
    );
    // Lone surrogates are legal RFC 8259 text and keep their position in UTF-16 order.
    assert_eq!(
        sort(r#"{"\uffff":1,"\ud800":2,"😀":3}"#, opts()).unwrap(),
        r#"{"\ud800":2,"😀":3,"\uffff":1}"#
    );
    assert_eq!(
        minify(" [ 1 , {\"b\":1, \"a\" :2} ] ", opts()).unwrap(),
        r#"[1,{"b":1,"a":2}]"#
    );
}

#[test]
fn errors_and_limits() {
    for bad in [
        "",
        " ",
        "[1,]",
        "{} x",
        "[01]",
        "{\"x\":NaN}",
        "[\"\u{1}\"]",
        "\u{feff}1",
        "{\"a\" 1}",
        "[1 2]",
        "\"\\x\"",
        "\"\\u12\"",
        "-",
        "1.",
        "1e",
        "+1",
        "{,}",
        "[",
        "{\"a\":",
        "tru",
        "\"abc",
        "1\u{c}",
    ] {
        assert!(validate(bad, Limits::default()).is_err(), "{bad:?}");
    }
    let limits = Limits::new(Some(2), Some(16)).unwrap();
    assert_eq!(validate("[[0]]", limits), Ok(()));
    assert_eq!(
        validate("[[[0]]]", limits).unwrap_err().kind,
        ErrorKind::DepthLimit
    );
    assert_eq!(
        validate("[1,2,3,4,5,6,7,8,9]", limits).unwrap_err().kind,
        ErrorKind::InputLimit
    );
    let growth = Options {
        limits: Limits::new(None, Some(8)).unwrap(),
        ..opts()
    };
    assert_eq!(
        canonicalize("[1e20]", growth).unwrap_err().kind,
        ErrorKind::OutputLimit
    );
    assert!(Limits::new(Some(0), None).is_err() && Limits::new(Some(MAX_DEPTH + 1), None).is_err());
    let deep = format!("{}{}", "[".repeat(100_000), "]".repeat(100_000));
    assert_eq!(
        validate(&deep, Limits::default()).unwrap_err().kind,
        ErrorKind::DepthLimit
    );
    let err = validate("{\n  \"é😀\": x}", Limits::default()).unwrap_err();
    assert_eq!(err.locate("{\n  \"é😀\": x}".as_bytes()), (2, 10));
    for (text, at) in [
        ("[1,\r2,\rx]", (3, 1)),
        ("[1,\r\n2,\r\nx]", (3, 1)),
        ("\r\r\n\nx", (4, 1)),
    ] {
        assert_eq!(
            validate(text, Limits::default())
                .unwrap_err()
                .locate(text.as_bytes()),
            at,
            "{text:?}"
        );
    }
    assert_eq!(
        from_utf8(b"[\"\xff\"]").unwrap_err(),
        Error {
            kind: ErrorKind::InvalidUtf8,
            offset: 2
        }
    );
}

#[test]
fn selection() {
    let doc = r#"{"a":[10,{"b~/":"x"}, 3 ],"dup":{"q":1},"dup":{"r":2},"":0}"#;
    let get = |path: &[&str]| select(doc, path, Limits::default()).unwrap();
    assert_eq!(get(&[]), Some(doc));
    assert_eq!(get(&["a", "1", "b~/"]), Some(r#""x""#));
    assert_eq!(get(&["a", "2"]), Some("3"));
    assert_eq!(get(&["a", "01"]), None);
    assert_eq!(get(&["a", "-"]), None);
    assert_eq!(get(&["dup", "q"]), None);
    assert_eq!(get(&["dup", "r"]), Some("2"));
    assert_eq!(get(&[""]), Some("0"));
    assert_eq!(get(&["a", "0", "x"]), None);
    assert_eq!(
        select(r#"{"\u0061":1}"#, &["a"], Limits::default()).unwrap(),
        Some("1")
    );
    assert!(select(r#"{"a":1,"b":[}"#, &["a"], Limits::default()).is_err());
}

/// Seeded generator of well-formed JSON with varied whitespace, escapes and numbers.
struct Gen(u64);

impl Gen {
    fn next(&mut self) -> u64 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 7;
        self.0 ^= self.0 << 17;
        self.0
    }
    fn below(&mut self, n: u64) -> usize {
        usize::try_from(self.next() % n).unwrap()
    }
    fn ws(&mut self, out: &mut String) {
        for _ in 0..self.below(3) {
            out.push([' ', '\n', '\t', '\r'][self.below(4)]);
        }
    }
    fn string(&mut self, out: &mut String) {
        const PIECES: &[&str] = &[
            "a",
            "b",
            "z",
            "é",
            "€",
            "😀",
            "\u{ffff}",
            "\u{e000}",
            "\\n",
            "\\\"",
            "\\\\",
            "\\/",
            "\\u0041",
            "\\u00e9",
            "\\ud83d\\ude00",
            "\\u001f",
            " ",
            "0",
            "ab",
        ];
        out.push('"');
        for _ in 0..self.below(4) {
            out.push_str(PIECES[self.below(PIECES.len() as u64)]);
        }
        out.push('"');
    }
    fn number(&mut self, out: &mut String) {
        const NUMBERS: &[&str] = &[
            "0",
            "-0",
            "1",
            "-1",
            "1.0",
            "1.50",
            "1e2",
            "1E+2",
            "1e-7",
            "0.000001",
            "123456789012345678",
            "9007199254740993",
            "3.141592653589793",
            "1e21",
            "1e308",
            "5e-324",
            "-2.5e-3",
            "100",
            "0.1",
            "999999999999999",
        ];
        out.push_str(NUMBERS[self.below(NUMBERS.len() as u64)]);
    }
    fn value(&mut self, out: &mut String, depth: u32) {
        self.ws(out);
        match self.below(if depth > 5 { 5 } else { 8 }) {
            0 => out.push_str("null"),
            1 => out.push_str(["true", "false"][self.below(2)]),
            2 | 3 => self.number(out),
            4 => self.string(out),
            5 | 6 => {
                out.push('{');
                let mut keys = Vec::new();
                for i in 0..self.below(5) {
                    if i > 0 {
                        out.push(',');
                    }
                    self.ws(out);
                    let mut key = String::new();
                    self.string(&mut key);
                    out.push_str(&key);
                    keys.push(key);
                    self.ws(out);
                    out.push(':');
                    self.value(out, depth + 1);
                }
                self.ws(out);
                out.push('}');
            }
            _ => {
                out.push('[');
                for i in 0..self.below(5) {
                    if i > 0 {
                        out.push(',');
                    }
                    self.value(out, depth + 1);
                }
                self.ws(out);
                out.push(']');
            }
        }
        self.ws(out);
    }
}

#[test]
fn seeded_differential_against_serde() {
    let mut g = Gen(0x5EED_1234_ABCD_0001);
    let (mut valid, mut duplicates) = (0, 0);
    for case in 0..20_000 {
        let mut doc = String::new();
        g.value(&mut doc, 0);
        let reference: Value =
            serde_json::from_str(&doc).unwrap_or_else(|e| panic!("{case}: {e}: {doc}"));
        validate(&doc, Limits::default()).unwrap();
        let minified = minify(&doc, opts()).unwrap();
        assert_eq!(
            serde_json::from_str::<Value>(&minified).unwrap(),
            reference,
            "{doc}"
        );
        assert!(
            !minified.contains([' ', '\n', '\t', '\r'])
                || doc.contains("\" \"")
                || minified.contains('"')
        );
        match sort(&doc, opts()) {
            Ok(sorted) => {
                valid += 1;
                assert_eq!(
                    serde_json::from_str::<Value>(&sorted).unwrap(),
                    reference,
                    "{doc}"
                );
                assert_eq!(sort(&sorted, opts()).unwrap(), sorted, "sort is idempotent");
                let canonical = canon(&doc).unwrap();
                assert_eq!(
                    canon(&canonical).unwrap(),
                    canonical,
                    "canonical is a fixed point: {doc}"
                );
                assert_eq!(canon(&sorted).unwrap(), canonical);
            }
            Err(e) => {
                assert_eq!(e.kind, ErrorKind::DuplicateKey, "{doc}");
                duplicates += 1;
            }
        }
    }
    assert!(valid > 10_000 && duplicates > 100, "{valid} {duplicates}");
}

/// Independent escape walker: true when a `\u` escape yields an unpaired surrogate.
fn has_lone_surrogate(text: &str) -> bool {
    let b = text.as_bytes();
    let unit = |i: usize| {
        (b.get(i..i + 2) == Some(br"\u"))
            .then(|| {
                text.get(i + 2..i + 6)
                    .and_then(|h| u16::from_str_radix(h, 16).ok())
            })
            .flatten()
    };
    let mut i = 0;
    while i < b.len() {
        if b[i] != b'\\' {
            i += 1;
            continue;
        }
        match unit(i) {
            Some(0xD800..=0xDBFF)
                if unit(i + 6).is_some_and(|u| (0xDC00..=0xDFFF).contains(&u)) =>
            {
                i += 12;
            }
            Some(0xD800..=0xDFFF) => return true,
            Some(_) => i += 6,
            None => i += 2,
        }
    }
    false
}

#[test]
fn seeded_mutations_agree_with_serde_on_validity() {
    let mut g = Gen(0xBAD_5EED_0000_0042);
    let mut rejected = 0;
    for _ in 0..30_000 {
        let mut doc = String::new();
        g.value(&mut doc, 0);
        let mut bytes = doc.into_bytes();
        for _ in 0..=g.below(2) {
            let at = g.below(bytes.len() as u64 + 1);
            match g.below(3) {
                0 if at < bytes.len() => {
                    bytes.remove(at);
                }
                1 => bytes.insert(at, b"{}[],:\"\\01e.-tn \x01"[g.below(17)]),
                _ if at < bytes.len() => bytes[at] = b"{}[],:\"\\0ae"[g.below(11)],
                _ => {}
            }
        }
        let Ok(text) = std::str::from_utf8(&bytes) else {
            continue;
        };
        let theirs = serde_json::from_str::<Value>(text);
        // RFC 8259 permits lone surrogate escapes; serde_json rejects them. Accept the
        // disagreement only when our canonicalizer independently reports a lone surrogate.
        if theirs
            .as_ref()
            .is_err_and(|e| e.to_string().contains("escape"))
            && validate(text, Limits::default()).is_ok()
        {
            assert!(has_lone_surrogate(text), "{text:?}");
            continue;
        }
        // Huge exponents are valid grammar; serde_json rejects them as out of range.
        if theirs
            .as_ref()
            .is_err_and(|e| e.to_string().contains("out of range"))
        {
            assert!(canonicalize(text, opts()).is_err());
            continue;
        }
        let ours = validate(text, Limits::default());
        assert_eq!(ours.is_ok(), theirs.is_ok(), "{text:?} {ours:?} {theirs:?}");
        rejected += usize::from(ours.is_err());
        for result in [
            sort(text, opts()).map(drop),
            minify(text, opts()).map(drop),
            canonicalize(text, opts()).map(drop),
        ] {
            if ours.is_err() {
                assert!(result.is_err());
            }
        }
    }
    assert!(rejected > 10_000, "{rejected}");
}
