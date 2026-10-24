//! Node-API surface. The TypeScript wrapper owns argument validation and turns the
//! `code|offset|line|column|argument|message` reason strings into `JsonError`.

use napi::bindgen_prelude::{AsyncTask, Buffer, BufferSlice, Either, ToNapiValue, Unknown};
use napi::{Env, Error, Result, ScopedTask, Status};
use napi_derive::napi;
use stable_json_core::{self as engine, Limits, Options};

type Input<'a> = Either<String, BufferSlice<'a>>;

fn bytes<'a>(input: &'a Input<'_>) -> &'a [u8] {
    match input {
        Either::A(text) => text.as_bytes(),
        Either::B(buffer) => buffer,
    }
}

fn reason(error: engine::Error, input: &[u8], argument: u8) -> Error {
    let (line, column) = error.locate(input);
    let code = error.kind.code();
    Error::new(
        Status::GenericFailure,
        format!(
            "{code}|{}|{line}|{column}|{argument}|{}",
            error.offset, error.kind
        ),
    )
}

fn text(input: &[u8], argument: u8) -> Result<&str> {
    engine::from_utf8(input).map_err(|e| reason(e, input, argument))
}

fn options(
    max_depth: Option<u32>,
    max_bytes: Option<u32>,
    strict_numbers: bool,
) -> Result<Options> {
    let limits = Limits::new(max_depth, max_bytes.map(|b| b as usize))
        .map_err(|e| Error::new(Status::InvalidArg, e.kind.to_string()))?;
    Ok(Options {
        limits,
        strict_numbers,
    })
}

fn transform(input: &[u8], mode: u32, options: Options) -> Result<String> {
    let source = text(input, 0)?;
    let result = match mode {
        0 => engine::minify(source, options),
        1 => engine::sort(source, options),
        2 => engine::canonicalize(source, options),
        _ => return Err(Error::new(Status::InvalidArg, "unknown mode")),
    };
    result.map_err(|e| reason(e, input, 0))
}

/// External buffers avoid a copy but cost several microseconds each to create and
/// finalize, which dominated small outputs (4 KB canonicalized at half the speed of
/// returning a string). Below this size a plain copy is cheaper.
const COPY_BELOW: usize = 64 * 1024;

fn output(env: &Env, text: String, as_buffer: bool) -> Result<Unknown<'_>> {
    if !as_buffer {
        text.into_unknown(env)
    } else if text.len() < COPY_BELOW {
        (&BufferSlice::copy_from(env, text)?).into_unknown(env)
    } else {
        Buffer::from(text).into_unknown(env)
    }
}

/// Mode 0 minifies, 1 sorts keys, 2 canonicalizes per RFC 8785.
#[napi(ts_return_type = "string | Buffer")]
pub fn transform_sync<'env>(
    env: &'env Env,
    input: Either<String, BufferSlice>,
    mode: u32,
    as_buffer: bool,
    max_depth: Option<u32>,
    max_bytes: Option<u32>,
    strict_numbers: bool,
) -> Result<Unknown<'env>> {
    let options = options(max_depth, max_bytes, strict_numbers)?;
    output(env, transform(bytes(&input), mode, options)?, as_buffer)
}

pub struct Transform {
    input: Vec<u8>,
    mode: u32,
    as_buffer: bool,
    options: Options,
}

impl<'task> ScopedTask<'task> for Transform {
    type Output = String;
    type JsValue = Unknown<'task>;

    fn compute(&mut self) -> Result<String> {
        transform(&self.input, self.mode, self.options)
    }

    fn resolve(&mut self, env: &'task Env, text: String) -> Result<Unknown<'task>> {
        output(env, text, self.as_buffer)
    }
}

/// Copies the input up front: JavaScript may mutate a Buffer while the worker runs.
#[napi(ts_return_type = "Promise<string | Buffer>")]
pub fn transform_async(
    input: Either<String, BufferSlice>,
    mode: u32,
    as_buffer: bool,
    max_depth: Option<u32>,
    max_bytes: Option<u32>,
    strict_numbers: bool,
) -> Result<AsyncTask<Transform>> {
    let options = options(max_depth, max_bytes, strict_numbers)?;
    let input = match input {
        Either::A(text) => text.into_bytes(),
        Either::B(buffer) => buffer.to_vec(),
    };
    Ok(AsyncTask::new(Transform {
        input,
        mode,
        as_buffer,
        options,
    }))
}

#[napi]
pub fn validate(
    input: Either<String, BufferSlice>,
    max_depth: Option<u32>,
    max_bytes: Option<u32>,
) -> Result<()> {
    let limits = options(max_depth, max_bytes, false)?.limits;
    let input = bytes(&input);
    engine::validate(text(input, 0)?, limits).map_err(|e| reason(e, input, 0))
}

#[napi]
pub fn select(
    input: Either<String, BufferSlice>,
    path: Vec<String>,
    max_depth: Option<u32>,
    max_bytes: Option<u32>,
) -> Result<Option<String>> {
    let limits = options(max_depth, max_bytes, false)?.limits;
    let input = bytes(&input);
    engine::select(text(input, 0)?, &path, limits)
        .map(|found| found.map(str::to_owned))
        .map_err(|e| reason(e, input, 0))
}

#[napi]
pub fn equal(
    a: Either<String, BufferSlice>,
    b: Either<String, BufferSlice>,
    max_depth: Option<u32>,
    max_bytes: Option<u32>,
    strict_numbers: bool,
) -> Result<bool> {
    let options = options(max_depth, max_bytes, strict_numbers)?;
    let canonical = |input: &[u8], argument| {
        engine::canonicalize(text(input, argument)?, options)
            .map_err(|e| reason(e, input, argument))
    };
    Ok(canonical(bytes(&a), 0)? == canonical(bytes(&b), 1)?)
}
