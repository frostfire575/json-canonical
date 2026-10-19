# Independent native output representation review

Date: 2026-10-19. Reviewer: compatibility subagent, separate from implementation
and performance measurement agents. Scope: `src/output.rs`, relevant `src/lib.rs`
binding changes, existing `tests/native-output.test.cjs`, generated native types,
and the locked napi `Utf16String` implementation. No production files were edited.

## Source findings

The candidate changes only the representation used to return completed JSON text.
The engine still validates and sorts before `output::encode` runs. UTF-8 input,
token spelling, ordering, duplicate-key rejection, depth limits and per-document
UTF-8 input/output byte limits remain in the existing engine. `selectJson` is
unchanged. Batch ordering and document error indexing remain unchanged.

`Either<String, Utf16String>` is converted by napi-rs to a primitive JavaScript
string on both branches. Inspection of locked napi 3.14.2 confirms that
`Utf16String::from(String)` uses `encode_utf16().collect()` and its return binding
uses `napi_create_string_utf16`. This does not normalize scalar Unicode, escapes,
combining characters or numeric tokens. The candidate adds no unsafe code.
Generated native declarations explicitly retain `string` and `string[]` through
`ts_return_type`; public wrapper declarations remain unchanged.

The branch threshold uses UTF-8 output bytes, not JavaScript string length.
The revised candidate samples four evenly distributed 256-byte slices of outputs
at least 1024 bytes, choosing UTF-16 only if every slice has at least 32 non-ASCII
bytes. These are byte slices: sample boundaries need not be UTF-8 character
boundaries, because no sample is decoded or sliced as `str`. Index arithmetic is
bounded by the engine's 64 MiB maximum; for every sample `start <= len - 256`.
It creates an additional UTF-16 allocation after engine serialization, not zero-copy
output. Routing is a performance choice requiring independent measurements;
these correctness tests do not justify it or establish a speedup. The first
full-scan density heuristic was replaced by the lead after a measured sparse
workload regression; this review does not count that rejected heuristic as final.

Literal ill-formed UTF-16 input remains rejected by the public wrapper. Escaped
lone-surrogate value tokens are ASCII escape sequences inside the valid Rust
string and are retained verbatim in either output branch. No broader surrogate
key support is introduced.

## Executed adversarial tests

Added `tests/output-review.test.cjs` independently of the implementation agent's
tests. It includes 40 exact byte-size/density documents: output lengths
1022, 1023, 1024, 1025, 1026, 2047, 2048 and 2049 bytes, with Unicode density below,
at and above nearby branch thresholds. Tests exercise public calls, direct binding
calls and both batch entry points, requiring primitive strings and exact output.

Additional cases combine control characters, escaped NUL, Latin-1, combining
sequences, Unicode line separators, noncharacters, supplementary-plane endpoints,
emoji, Bengali, UTF-16-sensitive key ordering, literal escaped lone surrogates,
alternate escape spellings and lexical numeric tokens. Mixed ASCII/Unicode batches
are checked in order. UTF-8 byte-limit equality and one-byte failure, invalid and
duplicate keys, malformed documents, nesting limits and atomic batch errors are
verified through the actual candidate addon. A fourth test group adds seven
documents with Unicode prefixes and ASCII tails, ASCII prefixes and Unicode
tails, Unicode in the middle, Unicode at both ends, alternating blocks and isolated
supplementary scalars. These cases verify content and ordering through wrapper,
direct binding and batch even when sampling observes different Unicode densities.

Command executed on Windows x64, Node `v24.20.0`:

`node --test tests/output-review.test.cjs`

First candidate result: **PASS**, 3 tests, 0 failures, 0 skips; runner duration
62.4517 ms. Revised sampled candidate result: **PASS**, 4 tests, 0 failures, 0
skips; runner duration 71.0025 ms. All executable checks finished before the
lead's subsequent isolated benchmark windows.
These runner durations describe test execution only and are not performance claims.

## Verdict and limits

No correctness defect found. The candidate preserves the documented return types,
lossless output and error/limit semantics in inspected code and executed tests.
The tests verify outputs rather than instrumenting private branch selection;
the route selection is independently checked by source and exact byte-size inputs.
The lead separately reported full compilation, Rust/JS/types checks and clippy;
this report counts only the independent command above as this reviewer's execution.
Linux/macOS correctness, cross-platform performance and minimum-Rust behavior remain
UNVERIFIED by this reviewer. Adoption must also pass the lead's performance gates.
