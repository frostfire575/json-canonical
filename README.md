# stable-json-rs

Deterministic JSON for Node.js, with an upstream-compatible JavaScript API and
a separate Rust/napi-rs v3 engine for existing JSON text. Experimental 0.1.0;
not yet a published or production-verified release. Rust acceleration of live
JavaScript objects is **not** promised.

```sh
# Build this checkout (Node >=22.13, pnpm 12.10.1, Rust >=1.88, platform linker)
pnpm install --frozen-lockfile
pnpm build
pnpm check
```

The intended npm name is `stable-json-rs`. Publication has not been authorized.
Local packed artifacts include the host native binary and need no end-user Rust
compiler. Per-platform optional packages remain a release engineering task.

```js
// CommonJS
const { stringify, stringifyJson } = require('stable-json-rs');
stringify({ b: 2, a: 1 }); // '{"a":1,"b":2}'
stringifyJson('{"b":2,"a":1}'); // '{"a":1,"b":2}', Rust text engine
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
targeted by CI but **UNVERIFIED** until their jobs execute. Node 24.20.0 is the
only locally tested runtime.

Initial measured upstream baseline on this Windows i7-12700K / Node 24.20.0:
tiny object about 1.73M ops/s; real 143,844-byte dependency lock about 1,938 ops/s
(7 samples, 35 ms each). These are short baseline measurements, not claims of
Rust speedup. See [performance](docs/performance.md) and raw artifacts under
`benches/results` for complete comparisons and limitations.

[API](docs/api.md) · [compatibility](docs/compatibility.md) ·
[architecture](docs/architecture.md) · [security](docs/security.md) ·
[research and attribution](docs/research.md) · [roadmap](docs/roadmap/README.md).

Compatibility traversal is adapted from MIT-licensed fast-json-stable-stringify,
copyright Evgeny Poberezkin and James Halliday; see LICENSE and NOTICE.
