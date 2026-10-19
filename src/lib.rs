mod engine;

use napi::{Error, Result, Status};
use napi_derive::napi;

fn options(depth: Option<u32>, bytes: Option<u32>) -> Result<engine::Limits> {
    engine::Limits::new(depth, bytes).map_err(invalid)
}
fn invalid(message: String) -> Error {
    Error::new(Status::InvalidArg, message)
}

#[napi]
pub fn stringify_json(
    input: String,
    max_depth: Option<u32>,
    max_bytes: Option<u32>,
) -> Result<String> {
    engine::stringify(&input, options(max_depth, max_bytes)?).map_err(invalid)
}

#[napi]
pub fn stringify_json_batch(
    inputs: Vec<String>,
    max_depth: Option<u32>,
    max_bytes: Option<u32>,
) -> Result<Vec<String>> {
    let limits = options(max_depth, max_bytes)?;
    if inputs.len() > 1024 || inputs.iter().map(String::len).sum::<usize>() > 64 * 1024 * 1024 {
        return Err(invalid("Batch exceeds 1024 documents or 64 MiB".into()));
    }
    inputs
        .iter()
        .enumerate()
        .map(|(index, input)| {
            engine::stringify(input, limits)
                .map_err(|error| invalid(format!("Batch item {index}: {error}")))
        })
        .collect()
}
