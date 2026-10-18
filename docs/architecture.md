# Architecture

The compatibility API traverses JavaScript values in TypeScript and delegates
primitive escaping/number formatting to V8. It is adapted from the pinned MIT
upstream. This preserves property access, comparator, toJSON, UTF-16 and number
semantics without crossing Node-API for each property. It is an explicit JS
fallback, not a claim of Rust acceleration for arbitrary objects.

The separate Rust engine consumes JSON text. It validates input, sorts decoded
object keys by UTF-16 code units and emits deterministic JSON while preserving
primitive JSON token spelling. The Node-API boundary transfers text in and out,
never arbitrary live objects. This API is not RFC 8785 canonicalization, and
different numeric/string spellings can produce different output. No unsafe Rust.
Default text input and output bounds are 16 MiB and maximum nesting is 128.
The engine and bindings are separate modules. Native loading is lazy so the
compatibility API is usable independently and native load errors stay visible
when a native API is requested. Official napi CLI generates the platform loader.

Batch compatibility calls preserve input order. Native text batching reduces
boundary crossings. Caching must require a caller-provided version on each call;
identity alone never implies immutability. WeakMap storage does not retain keys.
Parsing/selection/async/streaming/hashing need separate evidence before adoption.
