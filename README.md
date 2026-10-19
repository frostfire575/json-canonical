# stable-json-rs

Rust-backed tools for **existing JSON text**: deterministic key sorting with
`stringifyJson` and selective raw extraction with `selectJson`. A separate
upstream-compatible `stringify` API handles live JavaScript values for convenience
and compatibility. Experimental 0.1.0; not published or production-verified.

Use the native APIs when JSON text is already available and measurements justify
the pipeline. Their performance depends on document size, keys, Unicode and the
requested output. Extraction avoids building the full document as JavaScript
objects, but still validates all input and can be slower than `JSON.parse`.
Calls are synchronous and copy strings across Node-API.

| Input and intended result | API | Execution |
|---|---|---|
| JSON text to recursively key-sorted text | `stringifyJson` | Bounded Rust engine; preserves scalar token spelling |
| JSON text to one raw subtree/value | `selectJson` | Rust validation/traversal; preserves selected internal order and whitespace |
| Live JavaScript values to upstream-compatible text | `stringify` / `stableStringify` | JavaScript traversal; no native call or acceleration promise |
| Ordered collections | `stringifyBatch` / `stringifyJsonBatch` | Convenience APIs; no batching speed guarantee |
| Known unchanged versioned objects | `createSerializerCache` | Skips work only with correct caller-provided versions |

```js
// CommonJS: start with existing text, rather than serializing a live object first.
const { stringifyJson, selectJson } = require('stable-json-rs');
const input = '{"z":1.00,"users":[{"name":"Ada","id":7}],"a":-0}';
const limits = { maxDepth: 32, maxBytes: 1024 * 1024 };
stringifyJson(input, limits);
// '{"a":-0,"users":[{"id":7,"name":"Ada"}],"z":1.00}'
const rawName = selectJson(input, '/users/0/name', limits); // '"Ada"'
const name = rawName === undefined ? undefined : JSON.parse(rawName);
```

```ts
// ESM / TypeScript: the default export remains compatible stringify.
import { stringifyJson, selectJson, stringify, type JsonTextOptions } from 'stable-json-rs';
const limits: JsonTextOptions = { maxDepth: 32, maxBytes: 1024 * 1024 };
const ordered: string = stringifyJson('{"b":2,"a":1}', limits);
const selected: string | undefined = selectJson('{"a":null}', '/a', limits); // 'null'
const compatible: string | undefined = stringify({ b: 2, a: 1 });
```

Text sorting preserves numeric precision, exponent spelling, `-0` and scalar string
escapes. It rejects decoded duplicate keys and lone-surrogate keys. Equivalent
values with different spellings can produce different output; this is **not
RFC 8785 canonicalization**. Extraction returns raw JSON text: containers retain
key order/whitespace, traversed duplicate keys use the last value, and missing
paths return `undefined`. See the precise [API rules](docs/api.md).

For live objects, `stringify` preserves pinned fast-json-stable-stringify behavior,
including custom comparators, unsupported values, getters and toJSON. It stays in
JavaScript. Converting an object through `JSON.stringify` and the native text
sorter is a separate pipeline with different semantics; there is no automatic
native dispatch. Batch and explicit-version cache limitations are in the API docs.

```sh
# Build tools: Node 24, pnpm 12.10.1, Rust stable, platform linker
# Installed consumers: Node >=22.13.0
pnpm install --frozen-lockfile
pnpm setup:upstream
pnpm build
pnpm check
node examples/json-text.cjs
node examples/json-text.mjs
```

The intended npm name is `stable-json-rs`; publication is not authorized. Local
packed installations need no Rust compiler. The current CI design bundles three
native binaries into one root tarball. Correctly named optional platform packages
are an alternative, evaluated in [distribution](docs/distribution.md); the root
does not depend on unpublished registry packages.

Windows x64 release builds and Node 22.13.0/24.20.0 are locally verified. Linux x64,
macOS ARM64 and a genuine three-platform combined installation remain
**UNVERIFIED** until their actual jobs run. CJS/ESM and TypeScript examples ship in
`examples/`; the `.mts` example is type-checked with the declarations.

Independent Windows i7-12700K / Node 24.20.0 measurements used three shuffled
fresh-process passes, a one-second warmup and nine samples per cell. All sorting
comparisons below start with the **original downloaded text**, including whitespace,
and check identical output against `JSON.parse` plus pinned upstream serialization.

| Original existing JSON text | Rust sort ops/s | Parse + upstream ops/s |
|---|---:|---:|
| Application configuration |172713–177697|66546–74401|
| Dependency metadata |2339–2397|774–1090|
| API service backing data |172–178|106–115|
| Bengali CLDR data |5975–6698|3937–3988|
| Upstream mock API fixture |83997–84469|33233–35475|

These are ranges of three run medians on one machine, not confidence intervals
or universal speed guarantees. One dependency-metadata JS run had16.5% MAD;
all raw variation is retained. The API document's native wall-time cost was
5.61–5.80ms per operation. Memory observations include setup and do not establish
serializer-only allocation costs or a general lower-memory guarantee.

Extraction is measured separately against generic pointers and literal field
access. Only normalized dependency metadata repeats a >=10% gain against direct
fields; original metadata gains vary6–13%, and all other direct-field controls
lose. Raw output and avoiding a full JS document are functional reasons to use it.
See [the independent text review](docs/roadmap/NATIVE_TEXT_REVIEW_2.md) and
[performance by API](docs/performance.md) for input forms, exact paths, latency,
throughput, memory, negative controls, raw measurements and artifact identities.

Compatible CJS/ESM `stringify` has no repeatable >=10% gain over upstream in the
separate live-object matrix. It never calls Rust. Native batching was4–7% slower
than repeated native calls; it remains a convenience. Explicit-version caching
skips known unchanged records and adds overhead on misses. Converting live objects
to native text is a separate pipeline and can erase gains or change semantics.
Prior measurements remain in the [installed object review](docs/roadmap/PUBLIC_API_PERFORMANCE_REVIEW.md),
[reproduction](docs/roadmap/REPRODUCTION_REVIEW.md) and
[output investigation](docs/roadmap/OUTPUT_BENCHMARK_REVIEW.md).

[API](docs/api.md) · [compatibility](docs/compatibility.md) ·
[architecture](docs/architecture.md) · [security](docs/security.md) ·
[research and attribution](docs/research.md) · [roadmap](docs/roadmap/README.md).

Compatibility traversal is adapted from MIT-licensed fast-json-stable-stringify,
copyright Evgeny Poberezkin and James Halliday; see LICENSE and NOTICE.
