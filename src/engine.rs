use crate::tree::{self, Node};
use serde_json::value::RawValue;

#[derive(Clone, Copy)]
pub struct Limits {
    pub(crate) depth: usize,
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

pub fn stringify(input: &str, limits: Limits) -> Result<String, String> {
    let root = validate(input, limits)?;
    let mut output = String::with_capacity(input.len().min(limits.bytes));
    let tree = tree::parse(root.get(), limits.depth)?;
    write(&tree, &mut output, limits)?;
    Ok(output)
}

pub(crate) fn validate(input: &str, limits: Limits) -> Result<&RawValue, String> {
    if input.len() > limits.bytes {
        return Err("JSON input byte limit exceeded".into());
    }
    serde_json::from_str(input).map_err(|e| e.to_string())
}

fn append(out: &mut String, text: &str, limits: Limits) -> Result<(), String> {
    if text.len() > limits.bytes.saturating_sub(out.len()) {
        return Err("JSON output byte limit exceeded".into());
    }
    out.push_str(text);
    Ok(())
}
pub(crate) fn write(node: &Node<'_>, out: &mut String, limits: Limits) -> Result<(), String> {
    match node {
        Node::Object(members) => {
            append(out, "{", limits)?;
            for (index, member) in members.iter().enumerate() {
                if index > 0 {
                    append(out, ",", limits)?;
                }
                if member.token.as_bytes().contains(&b'\\') {
                    let key = serde_json::to_string(&member.key).map_err(|e| e.to_string())?;
                    append(out, &key, limits)?;
                } else {
                    append(out, member.token, limits)?;
                }
                append(out, ":", limits)?;
                write(&member.value, out, limits)?;
            }
            append(out, "}", limits)
        }
        Node::Array(members) => {
            append(out, "[", limits)?;
            for (index, member) in members.iter().enumerate() {
                if index > 0 {
                    append(out, ",", limits)?;
                }
                write(member, out, limits)?;
            }
            append(out, "]", limits)
        }
        Node::Scalar(token) => append(out, token, limits),
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
