# Reliability and security

Rust text processing uses safe code and serde_json validation, with bounded
per-document UTF-8 input/output (default16MiB, maximum64MiB), nesting (maximum128)
and batch size (1024 / aggregate64MiB input). Native input is copied by Node-API
before Rust can apply byte limits. Batch output can be large; limits are not a
complete process memory budget. Traversal reparses raw nested containers; very
deep inputs incur extra scanning. Native processing is synchronous.

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
in roadmap evidence. No general security certification is claimed.
