# Research and upstream audit

Verified 2026-10-19. Sources below are primary maintainers' documentation,
source repositories, or standards. External benchmark tables are **not local
measurements** and are not evidence of this package's performance. Search is
not exhaustive; no claim is made that an exact Rust rewrite does not exist.

## Environment and reference

The inspected machine runs Windows x64, Node 24.20.0, V8
13.6.233.17-node.53, Node-API 10, pnpm 12.10.1, rustc 1.98.1 and Cargo
1.98.1. These were queried directly with Node and tool version commands.
The lead's environment inspection identifies Windows 11 and Git
2.55.0.windows.5; linker/build verification is a separate acceptance check.

Read-only upstream checkout: `upstream/fast-json-stable-stringify`.
Pinned commit: `49e230da2c84247b29ad4de02c9395793caefd15`.
Package version at that commit: 2.1.0.
[Pinned source](https://github.com/epoberezkin/fast-json-stable-stringify/tree/49e230da2c84247b29ad4de02c9395793caefd15).

The audit read `index.js`, `index.d.ts`, `package.json`, `README.md`,
`LICENSE`, all four `test/*.js` files, all four examples,
`benchmark/index.js`, and the full `benchmark/test.json` fixture (three
profile-like records containing tags and nested friends).
Runtime dependencies are empty. Development dependencies include Tape,
Benchmark.js, nyc, ESLint and competing serializers. The upstream package
supports Node >=8, uses CommonJS, and exposes a minimal ambient TypeScript
declaration that omits options and incorrectly describes every result as a
string (top-level `undefined` returns `undefined`).

### Measured source size

Count method: obtain tracked filenames with `git -C upstream/fast-json-stable-stringify
ls-files`, select `.js`/`.ts`, normalize CRLF to LF, split lines, and remove
only the final empty split element when a trailing newline exists. Nonblank
counts remove whitespace-only lines. These are physical line counts, not a
claim to have parsed executable statements or excluded comments lexically.

| File/group | Physical lines | Nonblank lines |
|---|---:|---:|
| `index.js` | 59 | 50 |
| `index.d.ts` | 4 | 4 |
| `test/cmp.js` | 13 | 11 |
| `test/nested.js` | 44 | 38 |
| `test/str.js` | 46 | 38 |
| `test/to-json.js` | 22 | 18 |
| `benchmark/index.js` | 31 | 24 |
| four examples combined | 20 | 18 |
| all tracked JS/TS | 239 | 201 |

Reproduce in Node: for each selected file read UTF-8, compute
`s.replace(/\r\n/g, '\n').split('\n')`, remove its last element if empty,
and count the array and `array.filter(line => line.trim())`.
The upstream JSON fixture is 3,965 bytes. The existing benchmark uses one
fixture and Benchmark.js to compare four stable serializers; JSON.stringify
is commented out. It does not record our required real-world provenance,
raw multi-run artifacts, cold starts, native-boundary costs, memory or
event-loop effects. Upstream README numbers are historical and must not be
reused as current results.

### Existing tests and compatibility findings

The four files contain 16 test blocks, each planning one assertion:

* `cmp.js`: reverse key comparator supplied as the second argument.
* `nested.js`: nested sorting, object cycle throws by default, explicit cycle
  marker, two distinct repeated-reference/non-cycle cases.
* `str.js`: simple object, undefined/null properties, NaN/Infinity,
  undefined array slot, and empty strings in objects and arrays.
* `to-json.js`: toJSON returning an object, string, or array.

Additional findings from source inspection and direct Node probes:

| Behavior | Upstream result / observable detail |
|---|---|
| Key order | `Object.keys(node).sort(...)`: own enumerable string keys; UTF-16 code unit order, including numeric-looking keys |
| Comparator | function shorthand or `opts.cmp`; receives `{key,value}` pairs; accesses values during sorting before final property serialization |
| Undefined/functions/symbols | omitted in objects, null in arrays; top-level may return undefined |
| Sparse array | indexed traversal reads holes (and inherited indexed values), substitutes null when recursion returns undefined |
| Numbers | finite numbers use JS string conversion; nonfinite becomes null; negative zero becomes `0` |
| BigInt | JSON.stringify delegation throws TypeError absent applicable custom toJSON |
| Boxed primitives | handled as ordinary objects; `new Number(2)` serializes as `{}` |
| toJSON | invoked before type/cycle handling, with zero arguments and the receiver; property is read repeatedly by the condition and invocation |
| Accessors/proxies | ordinary property/key/sort effects remain observable and exceptions propagate |
| Repeated references | allowed after an object is removed from the ancestor stack |
| Object cycles | TypeError `Converting circular structure to JSON`, or quoted `"__cycle__"` when `cycles === true` |
| Array-only cycles | arrays bypass the object ancestor stack; self-array reaches JS RangeError even with cycles:true |
| Strings | delegated to the current realm's JSON.stringify, including escaping lone surrogate code units |
| Options | falsy options become `{}`; cycles is accepted only if its value is boolean; no replacer/spacing API |

The README says cycle-marker output is not valid JSON, but the implementation
emits a quoted marker and valid JSON in the ordinary object-cycle case.
This is a documentation error in upstream, not a reason to emit invalid JSON.

Direct probe command used Node `require('./upstream/fast-json-stable-stringify')`
and printed results/exceptions for undefined, BigInt, -0, boxed Number,
self-array with cycles:true, keys U+E000/U+10000, toJSON argument count, an
object self-cycle, and a lone high surrogate. Observed respectively:
undefined; BigInt TypeError; `0`; `{}`; RangeError;
`{"𐀀":2,"":1}`; `0`; `{"x":"__cycle__"}`; `"\ud800"`.
These probes inform the test plan; they do not replace the full differential
suite or establish this project's compatibility.

The UTF-16 example is particularly important: Rust UTF-8 lexical sorting
would put U+E000 before U+10000, the opposite order. Converting strings through
Rust `String` can also reject or replace unpaired surrogates. JS number
formatting and toJSON timing cannot be assumed equivalent to Serde.

### License

Upstream is MIT, copyright 2017 Evgeny Poberezkin and 2013 James Halliday.
Copies or substantial adaptations must preserve both notices and the license
grant/disclaimer. Preserve the upstream license in attribution material when
adapting its compatibility traversal. The package identity remains
`stable-json-rs`; upstream is an oracle/reference, not our identity.
[Pinned license](https://github.com/epoberezkin/fast-json-stable-stringify/blob/49e230da2c84247b29ad4de02c9395793caefd15/LICENSE).

## Alternatives by category

All URLs in this section were opened or found in primary-source search on
2026-10-19. Versions in `latest` documentation and repository default branches
can change; installed lockfiles govern our executed comparisons.

| Category | Implementation | Relevant behavior and limits | Primary source |
|---|---|---|---|
| Exact API-compatible reference | fast-json-stable-stringify | Pinned JS oracle, comparator and cycles API; quirks above must be tested explicitly | [source](https://github.com/epoberezkin/fast-json-stable-stringify/tree/49e230da2c84247b29ad4de02c9395793caefd15) |
| Runtime JSON serializer | JSON.stringify / V8 | Insertion/property enumeration ordering, not recursively lexical ordering; rich JS semantics; contextual speed baseline only | [ECMAScript JSON.stringify](https://tc39.es/ecma262/multipage/structured-data.html#sec-json.stringify) |
| Functionally similar JS | safe-stable-stringify | Configurable determinism, cycle and BigInt behavior, limits, replacer and spacing; defaults differ from upstream, so compare only equivalent fixtures/options | [maintainer repository](https://github.com/BridgeAR/safe-stable-stringify) |
| Functionally similar JS | fast-stable-stringify | Intentionally fewer features; expects ordinary basic values without cycles, omits replacer and spacing; comparator equivalence must not be assumed | [maintainer repository](https://github.com/nickyout/fast-stable-stringify) |
| Schema-based serializer | fast-json-stringify | Compiles JSON Schema Draft 7 into a serializer; schema controls included properties and type handling; build/setup costs measured separately | [maintainer repository](https://github.com/fastify/fast-json-stringify) |
| General Rust JSON | serde_json | Robust Serde integration, typed/untyped parsing and serialization; not a representation of arbitrary JS values | [crate documentation](https://docs.rs/serde_json/latest/serde_json/) |
| General SIMD Rust JSON | simd-json | Borrowed/owned Rust value parsing and Serde integration; native parsing throughput does not measure JS object creation | [maintainer repository](https://github.com/simd-lite/simd-json) |
| SIMD and lazy Rust JSON | sonic-rs | Stable Rust, typed/untyped/lazy values and field extraction; architecture/CPU flags and portable distribution need care | [maintainer repository](https://github.com/cloudwego/sonic-rs) |
| Rust-backed npm specialized processing | @cnpmjs/packument | Concrete sonic-rs/Node native example extracting/diffing npm metadata from buffers and returning ranges; specialized API, not an upstream-compatible serializer | [maintainer repository](https://github.com/cnpm/packument) |
| Canonical JSON Rust | serde_json_canonicalizer | Documents RFC 8785 output, writer/vec/string APIs and text piping; library claims require independent conformance tests before adoption | [crate documentation](https://docs.rs/serde_json_canonicalizer/latest/serde_json_canonicalizer/index.html) |
| Number-format helper | ryu-js | ECMAScript-compatible float-to-string formatting candidate; validate against JS oracle if a numeric native engine is introduced | [crate documentation](https://docs.rs/ryu-js/latest/ryu_js/) |

Searches included `Rust Node npm stable stringify`, `stable-stringify Rust`,
`JSON napi-rs npm parse Rust`, canonicalizer crates, and known library names.
They found several similar/specialized implementations and standards tools,
but did not establish an exact drop-in Rust alternative. This is a limited
discovery result, not an absence claim.

### Reuse candidates and performance techniques

Serde's `RawValue` can borrow the byte span of an entire JSON value during
deserialization from str/slice, avoiding a DOM for that span. Reader-based
input needs owned buffering. This is a useful first candidate for selective
extraction and preserving number lexemes, rather than writing a new parser.
See [RawValue](https://docs.rs/serde_json/latest/serde_json/value/struct.RawValue.html).
Serde's default Map uses sorted Rust keys; `preserve_order` changes its backing
behavior, but neither setting by itself supplies upstream UTF-16 semantics.
See [Map](https://docs.rs/serde_json/latest/serde_json/map/struct.Map.html).

Sonic-rs offers checked field lookup and lazy array/object iteration. Its
README recommends native CPU compilation for maximum SIMD use; shipping those
flags blindly would undermine a portable binary. Unchecked parsing APIs are
unsuitable for untrusted input. Any selection API must specify whether it
validates the entire document and how missing keys, duplicate keys and
trailing invalid content behave. Package-specific published speed tables are
not proof of an advantage for our general API.

V8's JSON.stringify engineering report describes side-effect-free iterative
traversal, one-byte/two-byte string specialization, SIMD/SWAR escaping scans,
shape metadata reuse, Dragonbox number formatting, and segmented output
buffers. These are experiment ideas, not evidence that duplicating them through
Node-API wins. The report places its changes in V8 13.8, while this host reports
13.6; Node/V8 versions must accompany every benchmark.
[V8 engineering report](https://v8.dev/blog/json-stringify).

## Canonicalization is a separate contract

RFC 8785 JCS requires recursively sorted UTF-16 property names, ECMAScript
primitive serialization and UTF-8 output within I-JSON constraints; invalid
Unicode/nonfinite numbers and duplicate property names require particular
handling. Sorting JSON keys alone does not establish compliance.
Upstream permits nonfinite JS numbers (as null), cycle markers, callbacks and
unpaired surrogate strings. Therefore baseline upstream compatibility is not
a JCS-compliance claim, and a future digest API must identify its precise byte
rules. [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785).

## Native boundary and architecture recommendation

Official napi-rs v3 documentation specifies Rust >=1.88 and current CLI Node
requirements `^20.17.0 || ^22.13.0 || >=23.5.0`, plus a working platform linker.
The inspected tool versions satisfy these version constraints; the actual
build is the linker check. Official manual setup uses a cdylib, napi v3,
napi-derive v3, napi-build/build.rs and project-local @napi-rs/cli.
`napi build --platform --release` creates the native artifact and loader;
verify flags against installed CLI help before use. Target package generation
and cross-platform CI are separate from a host build.
[Getting started](https://napi.rs/docs/introduction/getting-started),
[manual setup](https://napi.rs/docs/introduction/manual-setup).

Official conversion documentation explicitly warns that serde_json::Value is
not lossless arbitrary JavaScript: undefined/functions/symbols and large BigInt
have distinct conversion behavior. JS-to-Rust strings also involve an owned
conversion, while buffer borrowing has lifetime constraints.
[Type conversions](https://napi.rs/docs/concepts/type-conversions).

Recommended first design: keep the exact JS compatibility traversal in a typed
wrapper; give Rust an explicit JSON-text boundary with its own documented
limits, number, duplicate-key and Unicode policy. Do not route arbitrary
objects through JSON.stringify plus serde_json under the compatibility name:
this changes toJSON arguments, property order/effects, number strings and
boxed-value behavior. Evaluate a span-based text serializer against a DOM
engine before attempting low-level Node-API traversal. Native advantages are
more plausible when bytes already exist or selection avoids materializing most
of a document; this is a hypothesis to test.

Initial benchmark hypotheses: per-call FFI/string copies may dominate tiny
values; one native batch call may amortize overhead for existing text; preserving
scalar spans may remove parse/reformat work; explicit version caches may help
immutable/versioned repeated data; full parsing to JS may lose to JSON.parse.
Each needs end-to-end release-addon measurements with correctness assertions,
real fixtures and raw artifacts before accepting it as a result.
## Independent Unicode workload provenance (2026-10-19)

CLDR Bengali language names are retained under `benches/profiling/data`, fixed at
commit `91c267402229a59e3ef2774544f001bf959e8809` of
[unicode-org/cldr-json](https://github.com/unicode-org/cldr-json/tree/91c267402229a59e3ef2774544f001bf959e8809).
The adjacent manifest records the raw source URL, retrieval time,25,897-byte source
and Unicode-3.0 license file hashes. The corpus is benchmark-only and not included
in the npm artifact. It tests a real localization configuration independently of
the dense synthetic Unicode fixture; source and normalized bytes are distinguished.
