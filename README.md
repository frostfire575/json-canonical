# stable-json-rs

Deterministic JSON for Node.js, with an upstream-compatible JavaScript API and
a separate Rust/napi-rs v3 engine for existing JSON text. Experimental 0.1.0;
not yet a published or production-verified release. Rust acceleration of live
JavaScript objects is **not** promised.

| API | Execution and intended use |
|---|---|
| `stringify` / `stableStringify` | JavaScript traversal with upstream semantics; no Rust call or automatic native conversion |
| `stringifyJson` | Rust sorting of existing JSON text; preserves scalar token spelling |
| `selectJson` | Raw JSON-text extraction with explicit path/validation rules |
| `stringifyBatch` / `stringifyJsonBatch` | Ordered convenience APIs; no batching speed guarantee |
| `createSerializerCache` | Skips serialization only when the caller supplies an unchanged version |

Object-input, existing-text and conversion-roundtrip benchmarks are separate
operations. A native JSON-text result is never a universal `stringify` speedup.

```sh
# Build this checkout (Node >=22.13, pnpm 12.10.1, Rust stable, platform linker)
pnpm install --frozen-lockfile
pnpm setup:upstream
pnpm build
pnpm check
```

The intended npm name is `stable-json-rs`. Publication has not been authorized.
Local packed artifacts include the host native binary and need no end-user Rust
compiler. CI assembles a candidate tarball bundling the three target binaries;
per-platform optional packages remain an alternative release layout.

```js
// CommonJS
const { stringify, stringifyJson, selectJson } = require('stable-json-rs');
stringify({ b: 2, a: 1 }); // '{"a":1,"b":2}'
stringifyJson('{"b":2,"a":1}'); // '{"a":1,"b":2}', Rust text engine
selectJson('{"users":[{"name":"Ada"}]}', '/users/0/name'); // '"Ada"'
```

```ts
// ESM / TypeScript
import stringify, { stringifyBatch, createSerializerCache } from 'stable-json-rs';
const output: string | undefined = stringify({ b: 2, a: 1 });
stringifyBatch([{ b: 2, a: 1 }, undefined]);
const cache = createSerializerCache();
const record = { name: 'Ada' };
cache.stringify(record, 1); // Explicit version on EVERY call
record.name = 'Grace';
cache.stringify(record, 2); // Change version on every relevant mutation
```

`stringify` / `stableStringify` preserve pinned fast-json-stable-stringify
behavior including custom comparators, unsupported values, getters and toJSON.
These functions deliberately run in JavaScript. `stringifyJson` and
`stringifyJsonBatch` use Rust, preserve scalar token spelling, reject duplicate
decoded keys/lone surrogate keys and enforce byte/depth bounds. They are not
RFC 8785 canonicalization. Use the compatibility API for arbitrary JS values.

Windows x64 has a verified local release build. Linux x64 and macOS ARM64 are
targeted by CI but **UNVERIFIED** until their jobs execute. Node 24.20.0 and
22.13.0 are locally tested runtimes.

Installed Windows i7-12700K / Node24.20.0 measurements used two fresh-process
runs, one-second warmup and nine samples per cell. On seven real-world inputs,
compatible CJS/ESM `stringify` and its alias showed **no repeatable >=10% gain**
over upstream. They use JavaScript traversal and do not load the native addon.

Separate existing-JSON-text results (median ops/s ranges across the two runs):

| Existing JSON text | JSON.parse + upstream ops/s | Rust text ops/s |
|---|---:|---:|
| Real dependency lock |1393–1427|3451–3558|
| Real API dataset |143–146|205–250|
| Real Bengali CLDR data |5110–5165|9311–9569|

The complete object-to-native pipeline includes `JSON.stringify` on every call:
it gained14–19% on dependency metadata but lost19–21% on CLDR. These JSON-only
fixtures do not justify automatic native routing for arbitrary JavaScript values.
Native batching was4–7% slower than repeated native calls; it remains an ordered,
bounded convenience. Explicit version caching skips known unchanged records and
adds overhead on misses. Selection won on dependency metadata and lost on the
API and CLDR inputs. All results are workload-specific, from one Windows machine.

See [performance by API](docs/performance.md) and the
[installed API review](docs/roadmap/PUBLIC_API_PERFORMANCE_REVIEW.md) for exact
outputs, variation, raw samples and artifact identities. The earlier3377/1338
text-only claim and Unicode profiling are preserved in
[independent reproduction](docs/roadmap/REPRODUCTION_REVIEW.md) and
[output investigation](docs/roadmap/OUTPUT_BENCHMARK_REVIEW.md).

[API](docs/api.md) · [compatibility](docs/compatibility.md) ·
[architecture](docs/architecture.md) · [security](docs/security.md) ·
[research and attribution](docs/research.md) · [roadmap](docs/roadmap/README.md).

Compatibility traversal is adapted from MIT-licensed fast-json-stable-stringify,
copyright Evgeny Poberezkin and James Halliday; see LICENSE and NOTICE.
