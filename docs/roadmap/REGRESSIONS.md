# Regressions

## 2026-10-19 fixed during MVP review
- Comparator must capture second opts.cmp read and invoke with no receiver.
  Regression tests compare dynamic getters, mutation and strict callback this.
- Object keys use indexed loop; Array.prototype iterator patches must not alter
  traversal. Regression executes in an isolated child.
- Literal lone surrogate text silently becomes U+FFFD at Node-API. Public native
  wrappers now reject ill-formed strings before conversion; escaped values retain
  spelling. Internal generated binding is not a supported public API.
- TS ESM default initially typed as CJS namespace: conditional .d.mts declaration
  verified by strict consumer compilation.

## 2026-10-19 packed-consumer harness correction
TypeScript7 exports package.json but not the bin/tsc subpath. The new packed TS
consumer check initially failed ERR_PACKAGE_PATH_NOT_EXPORTED before compilation.
Read the exported package.json bin manifest and resolve its declared executable
instead. Both npm and pnpm packed consumer checks now pass. No library API
expectation was weakened; this was test-runner executable discovery.

## 2026-10-19 output-routing regression caught before adoption
- Candidate1: output>=1024bytes, whole-output is_ascii plus non-ASCII count.
  Independent public API20control cells reproduced sparse-Unicode throughput
  10007/9957 vs original11849/11913ops/s (-15.5/-16.4%,~1%MAD). Rejected despite
  positive dense-Unicode/Latin1/realCLDR results; raw116cells retained in
  OUTPUT_BENCHMARK_REVIEW.md. No failing candidate merged or marked DONE.
- Isolated predicate probe00-55-33-341Z-25732: fullcount14.700us on sparse text;
  prefix-screen0.515us. Prefix-screen still14.955us on dense-prefix/ASCIItail,
  so that intermediate strategy was also rejected before production adoption.
- Revised bounded4x256byte sampling probe00-56-25-381Z-2764: dense0.513us,
  sparse0.300us,prefix/tail0.390us. Heuristic only chooses lossless encoding;
  serialization tokens/ordering/errors unchanged. Rebuilt pnpm check PASS:
  5Rust48JS/strictTS; both root and private clippy PASS. Independent public-API
  before/after gate is still PENDING. Original output route retained in archive.
