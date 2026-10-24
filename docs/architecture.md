# Architecture

## Layout

`crates/core` is the engine: plain Rust, no dependencies, no `unsafe` (the crate
forbids it). `crates/node` is the Node-API binding built with napi-rs v3; it
denies `unsafe` in its own code and only allows what the napi macros generate.
`js/index.ts` is the public API. It validates arguments, chooses how strings cross
into Rust, and turns native error strings into `JsonError`.

## One pass, output written while reading

`parser.rs` is a recursive descent parser over UTF-8 bytes that validates RFC 8259
and writes the requested output in the same pass. There is no token tree and no
separate validation step. Mode decides what happens to each token: validation
writes nothing, minify copies tokens, sort copies tokens and reorders objects,
canonical re-encodes strings and numbers and reorders objects.

Sorting does not allocate a node per value. Each object member is written to the
output as it is parsed and its byte span is pushed on a shared member stack. When
the object closes, the parser checks whether its members are already in order,
which costs nothing extra for machine-written JSON that is already sorted. If they
are not, it sorts the spans and records a patch (the body range plus the sorted
spans) without moving any bytes. After parsing, one pass copies the output with
every patch applied, so each byte is copied once however deep the unsorted
objects nest. Moving bytes at each level instead cost O(size × depth). Duplicate
keys are found as equal neighbours after sorting.

Keys compare by UTF-16 code units, which is RFC 8785 order and JavaScript's
default sort. `text::cmp_utf16` compares the UTF-8 bytes and corrects the single
case where byte order and UTF-16 order disagree: a supplementary character
against one in U+E000..U+FFFF. Keys written with escapes are decoded once into a
shared UTF-16 arena; lone surrogate escapes are legal RFC 8259 and keep their
UTF-16 position in sort mode.

String scanning skips eight bytes at a time with a SWAR test for `"`, `\` and
control bytes, written with safe `u64::from_le_bytes`.

## Numbers

Sort and minify never interpret numbers, so precision is never lost. Canonical
mode follows ECMA-262 `Number::toString` (`number.rs`):

1. A token with at most 15 significant digits in the normal double range already
   is its own shortest representation, because distinct decimals of that length
   map to distinct doubles. Its digits are re-spelled directly, with no float
   parse or format. Most real data takes this path.
2. Otherwise the token is parsed to the nearest double. Rust's `{:e}` gives the
   shortest round-trip length k. For k of 16 or 17, or a subnormal, `{:e}` can
   return a k-digit candidate that is not the closest, so the value is formatted
   again correctly rounded to k digits. Below 16 digits only one candidate exists.
   At an exact power of two the rounding interval is lopsided and the correctly
   rounded value can fall outside it, so there the rounded value and its two
   neighbours are parsed back and the closest one that round-trips wins.
3. `strictNumbers` compares the token's significant digits and exponent with the
   canonical digits and rejects any difference, so it catches numbers whose
   printed value would change, not numbers that are inexact in binary.

## Selection

`select` uses the validating mode with a path. Only values on the path are
tracked. Matching a key at one level clears any earlier match below it, which
gives `JSON.parse` last-duplicate-wins semantics in a single pass. The result is a
slice of the input, copied once into the returned string.

## Crossing the boundary

Measurements decided how text moves between JavaScript and Rust:

- Node-API string conversion makes three passes: measure UTF-8 length, zero-fill
  a buffer, transcode. For strings of 1 KiB and up, the wrapper instead encodes
  with `TextEncoder.encodeInto` into a reused buffer (at most 16 MiB retained)
  and passes it as a zero-copy `Buffer`. Smaller strings use the direct path.
- Both paths would turn a lone surrogate character into U+FFFD. Small strings are
  checked with `isWellFormed`; large ones are checked only when the encoded bytes
  contain U+FFFD, found with a byte search an order of magnitude faster.
- Buffer outputs under 64 KiB are copied into a normal Buffer. Larger ones become
  an external Buffer over the Rust allocation, which avoids the copy but costs
  several microseconds to create and finalize.
- Async variants copy the input before queueing, because JavaScript may change a
  Buffer while the worker reads it.

## Limits

Depth defaults to 128 and is capped at 1024, which keeps the recursion well under
a 1 MiB thread stack (libuv workers on Windows). `maxBytes` bounds the input and
separately the output; only canonical numbers can make output longer than input,
so that check runs after each re-spelled number.
