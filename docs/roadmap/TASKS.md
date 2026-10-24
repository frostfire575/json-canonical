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
| V2-FLOAT | P2 | V2-NUM | Close the float-heavy gap (0.8x of V8) | Floats fixture at or above 1.0x with 1M-double test passing | DONE (Ryu port, D10; floats 1.60x over three pinned runs) |
| V2-CLI | P2 | V2-JS | `stable-json` command for every operation, file or stdin input, exit status by outcome | `tests/cli.test.cjs` checks output against the API; `test:pack` runs the installed bin shim | DONE |
| V2-BENCH-API | P2 | V2-BENCH | Benchmark `equal` and `canonicalHash` against JavaScript baselines | Three pinned runs, outputs checked, results in docs/performance.md | DONE (hash 1.5-4.6x; equal 0.49-1.22x, REGRESSIONS.md) |
| V2-PUBLISH-CI | P1 | V2-CI | Release workflow: a `v*` tag runs the CI matrix and publishes the three tested addons with provenance | Manual run reaches `npm publish --dry-run` with all three addons in the tarball | DONE (run 40108866513) |
| V2-BENCH-PEERS | P1 | V2-BENCH | Benchmark against `canonical-json` and `json-stable-stringify` before naming the package "fast" | Three pinned runs, outputs checked, docs/performance.md and README updated | DONE (canonicalize 1.37-2.67x of canonical-json) |
| V2-ARM64 | P1 | V2-CI | Linux ARM64 (`aarch64-unknown-linux-gnu`) addon, built and tested on a native ARM runner | Green CI on `ubuntu-22.04-arm` with Node 22.13 and 24.22; release tarball holds four addons | DONE (run 40111746583) |
| V2-NAME | P0 | V2-BENCH-PEERS | Rename the npm package to `json-canonical`, commands `jcanon` and `json-canonical`, search-oriented description and keywords | `pnpm check`, `test:pack` runs both bin shims, release dry run | DONE |
| V2-RELEASE-PLEASE | P1 | V2-RELEASE | release-please keeps a Release PR with version and CHANGELOG from conventional commits; merging it publishes through the existing publish job. Tags made with GITHUB_TOKEN do not trigger other workflows, so the release-please workflow must call the publish job itself | Release PR opens on its own; merging it publishes a patch with provenance | TODO (after the first publish) |
| V2-STREAM | P3 | V2-CORE | Streaming canonicalization for inputs larger than memory | Use case first | DEFERRED |
| V2-WASM | P3 | V2-NODE | WASI build for platforms without a prebuilt addon | Use case first | DEFERRED |
| V2-RELEASE | P0 | V2-PUBLISH-CI | Publish: `NPM_TOKEN` repository secret, then push tag `v0.2.0` | Explicit approval | DONE (json-canonical@0.2.0, run 40113692205) |
