# Reliability and security

Rust text processing uses safe code and serde_json validation, with bounded
per-document UTF-8 input/output (default16MiB, maximum64MiB), nesting (maximum128)
and batch size (1024 / aggregate64MiB input). Native input is copied by Node-API
before Rust can apply byte limits. Batch output can be large; limits are not a
complete process memory budget. Borrowed token trees still allocate container and
member vectors. Dense output may also allocate a temporary UTF-16 vector before
Node creates the returned string; this is not zero-copy serialization. UTF-8 byte
limits continue to apply before this conversion and do not bound total RSS.
Serde validates the whole document before the safe structural
scanner runs; do not reuse that scanner as an independent validator. Native
processing is synchronous.

Text batches snapshot indexed values once before validating type, UTF-16 and
aggregate bytes. This prevents getters, custom iterators and later option reads
from replacing the values sent to Rust. Limit getters are captured once during
validation for all native APIs. These rules do not sandbox arbitrary JavaScript
callbacks or hostile global intrinsic monkeypatching.

Public wrappers reject literal malformed UTF-16 to avoid Node-API replacement.
Escaped surrogate values retain their text. Keys are decoded Unicode scalars;
duplicates are rejected. Errors propagate rather than returning partial results.
OOM can still terminate a process; Rust does not eliminate resource exhaustion.

Compatibility API intentionally follows upstream recursion and executes arbitrary
getters, proxies, comparators and toJSON. Use it only with objects whose execution
and size you trust. Deep graphs/array cycles can overflow the JS stack with a
RangeError. There is no sandbox or execution timeout. Native depth limits do not
apply to the compatibility API.

Cache correctness depends on explicit versions. Change versions for nested and
external state changes too. WeakMap avoids retaining keys, not cached output
memory while keys are live. Native binaries are executable code; only load
trusted artifacts. Dependency audit findings and release blockers are recorded
in [audit evidence](audits/README.md). On2026-10-19 pnpm audit reported zero
advisories; OSV queries for38 locked registry crates returned no advisories.
These database results do not establish absence of defects. No general security
certification is claimed.
