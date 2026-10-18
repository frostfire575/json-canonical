# Master plan

## Requirements and findings
Production-oriented Rust/napi v3 package with CJS, ESM, strict TS, documented
compatibility, independent review and reproducible real-workload measurements.
Upstream v2.1.0 is pinned at 49e230da2c84247b29ad4de02c9395793caefd15.
Research is recorded in ../research.md. V8 already specializes JSON serialization;
boundary costs and JS object materialization can erase any native advantage.

## Phases and acceptance
0. Bootstrap: inspect environment, upstream and primary sources; persistent docs.
1. Baseline: pinned real-world and synthetic datasets, equivalent output checks,
   warmup/repeated measurements/raw artifacts and environment metadata.
2. MVP: pure bounded Rust text serializer, napi v3 release build, typed wrappers,
   CJS/ESM integration and Rust unit tests.
3. Compatibility: execute all upstream cases and thousands of seeded exact-string
   differential tests; adversarial review including getters, cycles and Unicode.
4. Optimization: identify slow paths, compare architecture alternatives, record
   measurements; reject complexity without benefit. No speculative unsafe code.
5. Batch/cache: separate native text batch and JS-compatible batch; version-based
   weak cache with mutation/invalidation tests and measured hit/miss costs.
6. Advanced: independently evaluate parse, selective extraction, streaming, async,
   hash. Implement only justified workloads; otherwise explicitly defer/reject.
7. Readiness: CI target matrix, packed installation, dependency/license audit,
   usage examples, documentation and honest platform verification status.

## Testing and performance strategy
Node built-in runner, strict tsc, Rust tests/clippy/rustfmt, release binding tests,
upstream oracle, seeded property cases, independent adversarial tests. Benchmark
end-to-end APIs and parsing+serialization equivalents; native JSON is context,
not stable-equivalent. Real data includes upstream API fixture and public lockfile.
Record medians/ranges/CPU/RSS; allocation/peak memory unavailable measurements
must be labeled. Gate: no correctness regressions; native optimization should
improve intended end-to-end workload median by >=10% across multiple runs without
>10% unexplained regressions. Otherwise retain explicit JS path and report result.

## Risks and mitigation
Semantic drift: JS fallback + differential tests. Unicode: UTF-16 sort and raw
tokens. Stack/memory exhaustion: native limits, JS upstream limitations documented.
Stale cache: explicit version contract. Cross-platform packaging: hosted CI and
artifact install; unavailable targets stay unverified. Dependency drift: both
lockfiles. Native boundary overhead: benchmark text and full JS workloads separately.

## Completion criteria
All implemented tasks have executable evidence; deferrals carry reasons; public
docs match implementation; independent findings resolved. Production readiness
requires passing release gates on every claimed platform. No publication without
explicit approval. Finite session milestones must leave exact resumable commands.
