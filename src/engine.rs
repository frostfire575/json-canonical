use serde::de::{Deserialize, Deserializer, MapAccess, Visitor};
use serde_json::value::RawValue;
use std::fmt;

#[derive(Clone, Copy)]
pub struct Limits {
    depth: usize,
    bytes: usize,
}
impl Limits {
    pub fn new(depth: Option<u32>, bytes: Option<u32>) -> Result<Self, String> {
        let depth = depth.unwrap_or(128) as usize;
        let bytes = bytes.unwrap_or(16 * 1024 * 1024) as usize;
        if !(1..=128).contains(&depth) || !(1..=64 * 1024 * 1024).contains(&bytes) {
            return Err("Limits require maxDepth 1..128 and maxBytes 1..67108864".into());
        }
        Ok(Self { depth, bytes })
    }
}

// Retain raw leaves, including number precision and escaped lone surrogates in
// VALUES. Decoded keys must be Unicode scalar strings; reject lone surrogate keys.
struct Members<'a>(Vec<(String, &'a RawValue)>);
impl<'de> Deserialize<'de> for Members<'de> {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        struct MembersVisitor;
        impl<'de> Visitor<'de> for MembersVisitor {
            type Value = Members<'de>;
            fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
                f.write_str("a JSON object")
            }
            fn visit_map<M: MapAccess<'de>>(self, mut map: M) -> Result<Self::Value, M::Error> {
                let mut entries = Vec::new();
                while let Some(entry) = map.next_entry()? {
                    entries.push(entry);
                }
                Ok(Members(entries))
            }
        }
        deserializer.deserialize_map(MembersVisitor)
    }
}

pub fn stringify(input: &str, limits: Limits) -> Result<String, String> {
    if input.len() > limits.bytes {
        return Err("JSON input byte limit exceeded".into());
    }
    let root: &RawValue = serde_json::from_str(input).map_err(|e| e.to_string())?;
    let mut output = String::with_capacity(input.len().min(limits.bytes));
    write(root, &mut output, 0, limits)?;
    Ok(output)
}

fn append(out: &mut String, text: &str, limits: Limits) -> Result<(), String> {
    if text.len() > limits.bytes.saturating_sub(out.len()) {
        return Err("JSON output byte limit exceeded".into());
    }
    out.push_str(text);
    Ok(())
}
fn write(raw: &RawValue, out: &mut String, depth: usize, limits: Limits) -> Result<(), String> {
    let text = raw.get();
    match text.as_bytes()[0] {
        b'{' => {
            if depth >= limits.depth {
                return Err("JSON nesting limit exceeded".into());
            }
            let Members(mut members) = serde_json::from_str(text).map_err(|e| e.to_string())?;
            members.sort_unstable_by(|a, b| a.0.encode_utf16().cmp(b.0.encode_utf16()));
            if members.windows(2).any(|pair| pair[0].0 == pair[1].0) {
                return Err("Duplicate decoded object key".into());
            }
            append(out, "{", limits)?;
            for (index, (key, value)) in members.iter().enumerate() {
                if index > 0 {
                    append(out, ",", limits)?;
                }
                let key = serde_json::to_string(key).map_err(|e| e.to_string())?;
                append(out, &key, limits)?;
                append(out, ":", limits)?;
                write(value, out, depth + 1, limits)?;
            }
            append(out, "}", limits)
        }
        b'[' => {
            if depth >= limits.depth {
                return Err("JSON nesting limit exceeded".into());
            }
            let members: Vec<&RawValue> = serde_json::from_str(text).map_err(|e| e.to_string())?;
            append(out, "[", limits)?;
            for (index, value) in members.iter().enumerate() {
                if index > 0 {
                    append(out, ",", limits)?;
                }
                write(value, out, depth + 1, limits)?;
            }
            append(out, "]", limits)
        }
        _ => append(out, text, limits),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn sort(text: &str) -> Result<String, String> {
        stringify(text, Limits::new(None, None)?)
    }
    #[test]
    fn nested_and_utf16() {
        assert_eq!(
            sort(r#" {"\ue000":0,"😀":1,"a":[{"z":2,"a":3}]} "#).unwrap(),
            "{\"a\":[{\"a\":3,\"z\":2}],\"😀\":1,\"\u{e000}\":0}"
        );
    }
    #[test]
    fn tokens_and_duplicates() {
        assert_eq!(
            sort(r#"[1.00,1e+30,-0,"\ud800","\u0061"]"#).unwrap(),
            r#"[1.00,1e+30,-0,"\ud800","\u0061"]"#
        );
        assert!(sort(r#"{"a":1,"\u0061":2}"#).is_err());
        assert!(sort(r#"{"\ud800":1}"#).is_err());
    }
    #[test]
    fn validation_and_limits() {
        for bad in [
            "",
            "[1,]",
            "{} garbage",
            "[01]",
            "{\"x\":NaN}",
            "[\"\u{1}\"]",
        ] {
            assert!(sort(bad).is_err(), "{bad}");
        }
        assert!(stringify("[[0]]", Limits::new(Some(1), None).unwrap()).is_err());
        assert!(stringify("[0]", Limits::new(None, Some(2)).unwrap()).is_err());
        assert!(Limits::new(Some(129), None).is_err());
        // RawValue's initial validation must not overflow the native stack.
        assert!(sort(&format!("{}0{}", "[".repeat(10000), "]".repeat(10000))).is_err());
    }
}
