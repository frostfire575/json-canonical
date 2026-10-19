# Public API

The performance-oriented APIs consume existing JSON text: `stringifyJson` sorts
keys and `selectJson` extracts raw text. Choose them for measured workloads,
without converting arbitrary live objects to JSON first. Both are synchronous
and copy strings across Node-API; neither is streaming or zero-copy.

For live JavaScript values, `stringify` / `stableStringify` preserve upstream
behavior and run in JavaScript. The default export remains compatible `stringify`.
See [performance by API](performance.md) before choosing a pipeline and the
[distribution review](distribution.md) for native installation boundaries.

## Native JSON text
`stringifyJson(input: string, options?: JsonTextOptions): string`
`stringifyJsonBatch(inputs: readonly string[], options?: JsonTextOptions): string[]`

Options: `maxDepth` (integer 1..128, default128), `maxBytes` (integer 1..67108864,
default16777216). Bytes are UTF-8; the limit applies to input and output for each
document. Containers count toward nesting; `[0]` needs depth1. Batch maximum:
1024 documents and 64 MiB combined input. Errors include a zero-based batch item
index for document errors. No partial output on failure.
Text batches read length and each indexed input once, then validate and serialize
that snapshot. Sparse slots are invalid; custom array iterators and instance
methods do not control validation. Mutating the original array from an options
getter cannot replace the validated input. Text options are read once per call,
in maxDepth then maxBytes order; the captured validated limits reach Rust.
Batching is a convenience API, not a performance recommendation: real batches
were slower than repeated native calls in the independent Windows measurements.
The explicit version cache can be useful when callers know records are unchanged;
its performance depends on hit rate and serialization cost.

Entire JSON input is validated. Object keys are decoded, UTF-16 sorted, then
re-escaped; duplicate decoded keys and lone surrogate keys are rejected. Primitive
tokens retain their original spelling (including numeric precision, -0, exponent
and string escapes); whitespace outside primitive tokens is removed. Arrays retain
order. These rules are deterministic for a given text, but semantically equivalent
input spellings can produce different output. No JS callbacks, no JSON.parse
object materialization, no claim of JavaScript-number normalization or JCS.
Escaped lone surrogate **values** are retained; literal ill-formed UTF-16 input
strings are rejected before native conversion. Native validation/limit errors
are Error with Node-API InvalidArg code; wrapper type/range errors use TypeError
or RangeError. Native loading failures propagate when requesting a native API.
Native processing is synchronous and blocks the event loop.

## Selective JSON text extraction
`selectJson(input: string, path: string, options?: JsonTextOptions): string | undefined`
extracts raw JSON text without constructing the whole document as JS objects.
For example `selectJson('{"users":[{"name":"Ada"}]}', '/users/0/name')`
returns `'"Ada"'`. `JSON.parse` the result if a JavaScript value is needed.
Selected JSON null returns `'null'`; missing paths return undefined.

The path uses a small JSON Pointer syntax: empty string selects root, `/a/0`
selects object field then array index, `~1` encodes `/`, `~0` encodes `~`.
No URI fragments or expressions. Invalid syntax throws; missing array indices,
leading-zero indices, `-` or traversal through scalars return undefined. Maximum
128 path segments /64KiB path bytes. Whole input syntax and nesting are validated
even for missing/early selections; maxBytes/maxDepth are the same as text sorting.

Raw selected objects/arrays retain key order, internal whitespace, duplicate keys
and token spelling. Traversed object keys must decode to Unicode scalar strings:
a lone surrogate key at a traversed object level throws even if another key is
requested. Unvisited subtrees/root raw text may retain escaped surrogate keys.
On traversed duplicate names the last occurrence wins, like JSON.parse. These
choices mean this is a JSON Pointer subset, not a full RFC6901 compliance claim.
Rust only materializes one path-level decoded key at a time and scans raw values;
it still validates/scans all bytes and copies input/output at Node-API boundaries.
Deep paths may scan a subtree repeatedly. Calls are synchronous.

## Compatibility serialization
`stringify(value, options?)` and alias `stableStringify` return `string | undefined`.
Options: `{cmp?: (a:{key,value}, b:{key,value}) => number, cycles?: boolean}`
or comparator function shorthand. Default object keys sort lexically by UTF-16.
Object cycles throw TypeError, or become `"__cycle__"` with `cycles:true`.
Unsupported top-level values may return undefined. Getters/callbacks may throw.
No replacer or spacing. Array cycles/deep nesting can throw RangeError, following
upstream. Functions execute in JavaScript, with no native conversion.

`stringifyBatch(values, options?)` returns an ordered `(string|undefined)[]`,
calling compatibility serialization per value. Sparse input slots produce
undefined result entries. Any error aborts; no partial results are returned,
although earlier input getters/callbacks may already have run.

## Explicit version cache
`createSerializerCache(options?)` returns:
* `stringify(object, version)` — both arguments required. Uses object identity
  and `Object.is(version, previousVersion)` to reuse a result. Change version
  on every mutation affecting serialization, including nested state, prototypes,
  getters, comparator options or external callback state. No deep mutation
  detection. Passing the same version explicitly asserts unchanged output.
* `delete(object)` — invalidate one entry, returns whether present.
* `clear()` — replace the WeakMap, invalidating all entries.

One version/result is retained per weakly-held object. Large result strings cost
memory while the key remains alive. Exceptions are not cached. Undefined results
are cached. Unversioned calls throw TypeError; mutation with an unchanged version
violates the caller contract and can yield the old result.
