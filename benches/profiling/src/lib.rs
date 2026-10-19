//! Development-only probes. No probe is shipped in the npm package.
//! Probes isolate combined allocation/conversion stages, not pure memcpy costs.
#[path = "../../../src/engine.rs"]
mod engine;
#[path = "../../../src/tree.rs"]
#[allow(dead_code)]
mod tree;
use napi::{
    Error, Result, Status,
    bindgen_prelude::{Either, Utf16String},
};
use napi_derive::napi;

fn invalid(error: String) -> Error {
    Error::new(Status::InvalidArg, error)
}
fn limits() -> engine::Limits {
    engine::Limits::new(None, None).expect("fixed valid limits")
}

#[napi]
pub struct Probe {
    input: String,
    output: String,
    utf16: Vec<u16>,
}

#[napi]
pub struct BatchProbe {
    inputs: Vec<String>,
    outputs: Vec<String>,
}
#[napi]
impl BatchProbe {
    #[napi(constructor)]
    pub fn new(inputs: Vec<String>) -> Result<Self> {
        let outputs = inputs
            .iter()
            .map(|input| engine::stringify(input, limits()).map_err(invalid))
            .collect::<Result<Vec<_>>>()?;
        Ok(Self { inputs, outputs })
    }
    #[napi]
    pub fn boundary(&self) -> u32 {
        self.inputs.len() as u32
    }
    #[napi]
    pub fn accept_inputs(&self, inputs: Vec<String>) -> u32 {
        inputs.iter().map(|text| text.len() as u32).sum()
    }
    #[napi]
    pub fn stored_outputs(&self) -> Vec<String> {
        self.outputs.clone()
    }
    #[napi]
    pub fn stored_engine(&self) -> Result<u32> {
        self.inputs
            .iter()
            .map(|input| {
                engine::stringify(input, limits())
                    .map(|s| s.len() as u32)
                    .map_err(invalid)
            })
            .sum()
    }
    #[napi]
    pub fn sort_collected(&self, inputs: Vec<String>) -> Result<Vec<String>> {
        inputs
            .iter()
            .map(|input| engine::stringify(input, limits()).map_err(invalid))
            .collect()
    }
    #[napi]
    pub fn sort_preallocated(&self, inputs: Vec<String>) -> Result<Vec<String>> {
        let mut outputs = Vec::with_capacity(inputs.len());
        for input in inputs {
            outputs.push(engine::stringify(&input, limits()).map_err(invalid)?);
        }
        Ok(outputs)
    }
}

#[napi]
impl Probe {
    #[napi(constructor)]
    pub fn new(input: String) -> Result<Self> {
        let output = engine::stringify(&input, limits()).map_err(invalid)?;
        let utf16 = output.encode_utf16().collect();
        Ok(Self {
            input,
            output,
            utf16,
        })
    }
    #[napi]
    pub fn boundary(&self) -> u32 {
        self.input.len() as u32
    }
    #[napi]
    pub fn accept_utf8(&self, input: String) -> u32 {
        input.len() as u32
    }
    #[napi]
    pub fn accept_utf16(&self, input: Utf16String) -> u32 {
        input.len() as u32
    }
    #[napi]
    pub fn roundtrip_utf8(&self, input: String) -> String {
        input
    }
    #[napi]
    pub fn roundtrip_utf16(&self, input: Utf16String) -> Utf16String {
        input
    }
    #[napi]
    pub fn output_utf8(&self) -> &str {
        &self.output
    }
    #[napi]
    pub fn output_utf16(&self) -> Utf16String {
        self.utf16.clone().into()
    }
    #[napi]
    pub fn routing_full_scan(&self) -> bool {
        self.output.len() >= 1024
            && !self.output.is_ascii()
            && self.output.bytes().filter(|b| !b.is_ascii()).count() >= self.output.len() / 8
    }
    #[napi]
    pub fn routing_screened(&self) -> bool {
        self.output.len() >= 1024
            && self
                .output
                .bytes()
                .take(1024)
                .filter(|b| !b.is_ascii())
                .count()
                >= 128
            && self.output.bytes().filter(|b| !b.is_ascii()).count() >= self.output.len() / 8
    }
    #[napi]
    pub fn routing_sampled(&self) -> bool {
        self.output.len() >= 1024
            && (0..4).all(|index| {
                let start = index * (self.output.len() - 256) / 3;
                self.output.as_bytes()[start..start + 256]
                    .iter()
                    .filter(|byte| !byte.is_ascii())
                    .count()
                    >= 32
            })
    }
    #[napi]
    pub fn stored_engine(&self) -> Result<u32> {
        engine::stringify(&self.input, limits())
            .map(|output| output.len() as u32)
            .map_err(invalid)
    }
    #[napi]
    pub fn engine_without_output_conversion(&self, input: String) -> Result<u32> {
        engine::stringify(&input, limits())
            .map(|output| output.len() as u32)
            .map_err(invalid)
    }
    #[napi]
    pub fn sort_utf16_output(&self, input: String) -> Result<Utf16String> {
        engine::stringify(&input, limits())
            .map(Utf16String::from)
            .map_err(invalid)
    }
    #[napi]
    pub fn sort_adaptive_output(&self, input: String) -> Result<Either<String, Utf16String>> {
        let output = engine::stringify(&input, limits()).map_err(invalid)?;
        let wide = output.len() >= 1024
            && !output.is_ascii()
            && output.bytes().filter(|byte| !byte.is_ascii()).count() >= output.len() / 8;
        Ok(if wide {
            Either::B(output.into())
        } else {
            Either::A(output)
        })
    }
    #[napi]
    pub fn sort_utf16_input_output(&self, input: Utf16String) -> Result<Utf16String> {
        let input = String::from_utf16(&input).map_err(|e| invalid(e.to_string()))?;
        engine::stringify(&input, limits())
            .map(Utf16String::from)
            .map_err(invalid)
    }
    #[napi]
    pub fn accept_utf16_transcoded(&self, input: Utf16String) -> Result<u32> {
        String::from_utf16(&input)
            .map(|text| text.len() as u32)
            .map_err(|e| invalid(e.to_string()))
    }
    #[napi]
    pub fn output_utf16_transcoded(&self) -> Utf16String {
        self.output.clone().into()
    }
    #[napi]
    pub fn sort_bulk_transcoded(&self, input: Utf16String) -> Result<Utf16String> {
        if encoding_rs::mem::utf16_valid_up_to(&input) != input.len() {
            return Err(invalid("Invalid UTF16".into()));
        }
        let mut buffer = vec![0; input.len() * 3];
        let written = encoding_rs::mem::convert_utf16_to_utf8(&input, &mut buffer);
        buffer.truncate(written);
        let text = String::from_utf8(buffer).map_err(|e| invalid(e.to_string()))?;
        let output = engine::stringify(&text, limits()).map_err(invalid)?;
        let mut units = vec![0; output.len()];
        let written = encoding_rs::mem::convert_str_to_utf16(&output, &mut units);
        units.truncate(written);
        Ok(units.into())
    }
    #[napi]
    pub fn validate_stored(&self) -> Result<u32> {
        engine::validate(&self.input, limits())
            .map(|raw| raw.get().len() as u32)
            .map_err(invalid)
    }
    #[napi]
    pub fn scan_sort_stored(&self) -> Result<u32> {
        // Constructor already validated this exact immutable string.
        let tree = tree::parse(&self.input, 128).map_err(invalid)?;
        std::hint::black_box(tree);
        Ok(self.input.len() as u32)
    }
    #[napi]
    pub fn emit_stored(&self) -> Result<u32> {
        // Tree construction excluded from the Rust timer, but included in the
        // method's JS duration. Return the internal measured nanoseconds only.
        let tree = tree::parse(&self.input, 128).map_err(invalid)?;
        let start = std::time::Instant::now();
        let mut output = String::with_capacity(self.input.len());
        engine::write(&tree, &mut output, limits()).map_err(invalid)?;
        std::hint::black_box(&output);
        Ok(start.elapsed().as_nanos().min(u32::MAX as u128) as u32)
    }
    #[napi]
    pub fn key_sort_clock(&self) -> Result<u32> {
        fn groups<'a>(node: &'a tree::Node<'_>, output: &mut Vec<Vec<&'a str>>) {
            match node {
                tree::Node::Object(members) => {
                    // Restore textual order before timing the exact UTF16 key
                    // comparator. Pointer addresses refer to one input buffer.
                    let mut keys: Vec<_> = members
                        .iter()
                        .map(|m| (m.token.as_ptr() as usize, m.key.as_ref()))
                        .collect();
                    keys.sort_unstable_by_key(|entry| entry.0);
                    output.push(keys.into_iter().map(|entry| entry.1).collect());
                    for member in members {
                        groups(&member.value, output);
                    }
                }
                tree::Node::Array(members) => {
                    for member in members {
                        groups(member, output);
                    }
                }
                tree::Node::Scalar(_) => {}
            }
        }
        let tree = tree::parse(&self.input, 128).map_err(invalid)?;
        let mut keys = Vec::new();
        groups(&tree, &mut keys);
        let start = std::time::Instant::now();
        for keys in &mut keys {
            keys.sort_unstable_by(|a, b| a.encode_utf16().cmp(b.encode_utf16()));
        }
        std::hint::black_box(&keys);
        Ok(start.elapsed().as_nanos().min(u32::MAX as u128) as u32)
    }
}
