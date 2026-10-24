# Tasks

Statuses: TODO, IN_PROGRESS, BLOCKED, DONE, DEFERRED, REJECTED. DONE means the
acceptance checks were run, and their results are in TEST_RESULTS.md.

| ID | Pri | Depends | Task | Acceptance | Status |
|---|---|---|---|---|---|
| V2-CORE | P0 | - | Zero-dependency single-pass engine: validate, minify, sort, canonicalize, select | Rust unit tests, 20k seeded documents and 30k mutations agree with serde_json | DONE |
| V2-NUM | P0 | V2-CORE | ECMA-262 number output, strict precision mode | RFC 8785 Appendix B vectors; 1M seeded doubles equal `String(n)` | DONE |
| V2-NODE | P0 | V2-CORE | napi binding: string/Buffer input, string/Buffer output, async, structured errors | JS API tests, async rejects with JsonError, Buffer mutation after call has no effect | DONE |
| V2-JS | P0 | V2-NODE | TypeScript API, `JsonError`, `canonicalizeValue`, `canonicalHash`, `equal`, CJS+ESM | Differential tests vs V8, module parity test, strict type tests | DONE |
| V2-BENCH | P0 | V2-JS | Benchmark against JS pipelines and the 0.1 addon, verified outputs, raw results | `benches/results/*.json` and docs/performance.md | DONE |
| V2-BOUNDARY | P1 | V2-BENCH | Faster string crossing (encodeInto, U+FFFD scan, copy for small Buffer output) | Before/after numbers in BENCHMARK_HISTORY.md, all tests pass | DONE |
| V2-PACK | P1 | V2-JS | Packed tarball installs and runs in a fresh consumer | `pnpm test:pack` | DONE |
| V2-REVIEW | P0 | V2-JS | Independent adversarial review and fixes | All confirmed findings fixed with regression tests (REGRESSIONS.md) | DONE |
| V2-CI | P1 | V2-PACK | CI on Windows x64, Linux x64, macOS ARM64 for Node 22.13 and 24 | Green workflow run | DONE (run 40101134172, all six jobs) |
| V2-FLOAT | P2 | V2-NUM | Close the float-heavy gap (0.8x of V8) | Floats fixture at or above 1.0x with 1M-double test passing | TODO (options: `ryu-js` dependency, or a hand-written Ryu/Schubfach) |
| V2-STREAM | P3 | V2-CORE | Streaming canonicalization for inputs larger than memory | Use case first | DEFERRED |
| V2-WASM | P3 | V2-NODE | WASI build for platforms without a prebuilt addon | Use case first | DEFERRED |
| V2-RELEASE | P0 | V2-CI | Publish | Explicit approval | BLOCKED |
