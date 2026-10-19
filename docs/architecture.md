# Architecture

The compatibility API traverses JavaScript values in TypeScript and delegates
primitive escaping/number formatting to V8. It is adapted from the pinned MIT
upstream. This preserves property access, comparator, toJSON, UTF-16 and number
semantics without crossing Node-API for each property. It is an explicit JS
fallback, not a claim of Rust acceleration for arbitrary objects.

The separate Rust engine consumes JSON text. Serde validates the whole input
once; a structural scanner builds a borrowed token tree, sorts decoded object
keys by UTF-16 code units and emits deterministic JSON while preserving primitive
JSON token spelling. Unescaped keys and scalar tokens borrow input slices; escaped
keys allocate decoded strings. The scanner is not a standalone validator and
must only receive validated text. The Node-API boundary transfers text in and out,
never arbitrary live objects. This API is not RFC 8785 canonicalization, and
different numeric/string spellings can produce different output. No unsafe Rust.
Default text input and output bounds are 16 MiB and maximum nesting is 128.
The engine and bindings are separate modules. Native loading is lazy so the
compatibility API is usable independently and native load errors stay visible
when a native API is requested. Official napi CLI generates the platform loader.

Batch compatibility calls preserve input order. Native text batching reduces
boundary crossings. Caching must require a caller-provided version on each call;
identity alone never implies immutability. WeakMap storage does not retain keys.
Selective extraction validates syntax and bounds on the full input, then uses
Serde visitors to retain only the matching raw value at each path level. It
avoids constructing full JS or Rust object trees, but may scan a subtree again
for deeper paths. It returns raw JSON text and has separate duplicate/Unicode
semantics. Parsing/async/streaming/hashing remain deferred pending use cases.
