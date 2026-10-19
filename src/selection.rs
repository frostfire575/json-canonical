//! JSON text selection: validate everything, materialize only path-level keys.
use crate::engine::Limits;
use serde::de::{DeserializeSeed, Deserializer, MapAccess, SeqAccess, Visitor};
use serde_json::value::RawValue;
use std::fmt;

enum Token<'a> {
    Key(&'a str),
    Index(usize),
}
struct Select<'a>(Token<'a>);
impl<'de> DeserializeSeed<'de> for Select<'_> {
    type Value = Option<&'de RawValue>;
    fn deserialize<D: Deserializer<'de>>(self, deserializer: D) -> Result<Self::Value, D::Error> {
        struct SelectVisitor<'a>(Token<'a>);
        impl<'de> Visitor<'de> for SelectVisitor<'_> {
            type Value = Option<&'de RawValue>;
            fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
                f.write_str("a JSON container")
            }
            fn visit_map<M: MapAccess<'de>>(self, mut map: M) -> Result<Self::Value, M::Error> {
                let Token::Key(target) = self.0 else {
                    return Ok(None);
                };
                let mut selected = None;
                while let Some((key, value)) = map.next_entry::<String, &'de RawValue>()? {
                    // Last duplicate wins, like JSON.parse; not full RFC6901.
                    if key == target {
                        selected = Some(value);
                    }
                }
                Ok(selected)
            }
            fn visit_seq<S: SeqAccess<'de>>(self, mut seq: S) -> Result<Self::Value, S::Error> {
                let Token::Index(target) = self.0 else {
                    return Ok(None);
                };
                let mut selected = None;
                let mut index = 0;
                while let Some(value) = seq.next_element::<&'de RawValue>()? {
                    if index == target {
                        selected = Some(value);
                    }
                    index += 1;
                }
                Ok(selected)
            }
        }
        match self.0 {
            Token::Key(_) => deserializer.deserialize_map(SelectVisitor(self.0)),
            Token::Index(_) => deserializer.deserialize_seq(SelectVisitor(self.0)),
        }
    }
}

pub fn select(input: &str, path: &[String], limits: Limits) -> Result<Option<String>, String> {
    let root = crate::engine::validate(input, limits)?;
    crate::tree::validate_depth(root.get(), limits.depth)?;
    let mut current = root;
    for segment in path {
        let token = match current.get().as_bytes()[0] {
            b'{' => Token::Key(segment),
            b'[' => {
                if segment.is_empty()
                    || (segment.len() > 1 && segment.starts_with('0'))
                    || !segment.bytes().all(|b| b.is_ascii_digit())
                {
                    return Ok(None);
                }
                let Ok(index) = segment.parse::<usize>() else {
                    return Ok(None);
                };
                Token::Index(index)
            }
            _ => return Ok(None),
        };
        let mut deserializer = serde_json::Deserializer::from_str(current.get());
        let selected = Select(token)
            .deserialize(&mut deserializer)
            .map_err(|e| e.to_string())?;
        let Some(selected) = selected else {
            return Ok(None);
        };
        current = selected;
    }
    Ok(Some(current.get().to_owned()))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn raw_selection_and_missing() {
        let limits = Limits::new(None, None).unwrap();
        let input = r#"{"a":[0,1.00],"z":null}"#;
        assert_eq!(
            select(input, &["a".into(), "1".into()], limits).unwrap(),
            Some("1.00".into())
        );
        assert_eq!(
            select(input, &["z".into()], limits).unwrap(),
            Some("null".into())
        );
        assert_eq!(select(input, &["missing".into()], limits).unwrap(), None);
    }
    #[test]
    fn validates_unselected_branches() {
        let limits = Limits::new(Some(2), None).unwrap();
        assert!(select(r#"{"a":1,"z":[[0]]}"#, &["a".into()], limits).is_err());
        assert!(select(r#"{"a":1,"z":[0,]}"#, &["a".into()], limits).is_err());
    }
}
