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
Semantic drift: explicit JS compatibility traversal + differential tests. Unicode: UTF-16 sort and raw
tokens. Stack/memory exhaustion: native limits, JS upstream limitations documented.
Stale cache: explicit version contract. Cross-platform packaging: hosted CI and
artifact install; unavailable targets stay unverified. Dependency drift: both
lockfiles. Native boundary overhead: benchmark text and full JS workloads separately.

## Completion criteria
All implemented tasks have executable evidence; deferrals carry reasons; public
docs match implementation; independent findings resolved. Production readiness
requires passing release gates on every claimed platform. No publication without
explicit approval. Finite session milestones must leave exact resumable commands.

## Independent continuation, 2026-10-19
Reproduced the earlier reported rates using a separate runner, two randomized runs,
real source and normalized fixtures, full public boundary costs and retained hashes.
Expanded baseline404 measured comparisons and compatibility25,740 seeded cases.
Added a pinned Unicode-3.0 CLDR Bengali corpus to complement synthetic Unicode.
Stage probes identify UTF8 output conversion as the dominant measured Unicode
category. Whole-output density counting introduced a measured sparse regression;
reject it. A bounded sampling candidate must pass the same public-API gates before
adoption. Batch preallocation offered no real throughput gain; retain convenience
semantics and explicit version caching without new acceleration claims.
Keep parse/stream/async/hash deferred. Final bundled artifact verification is
separate from source builds: CI packs once and each target/Node pair installs the
same checksum-bound candidate. Actual hosted target runs remain unavailable.

## Production-readiness priorities after independent output optimization
Accepted output encoding is retained; new APIs remain deferred. The current
continuation audits actual packed installs and all3target CI configuration, then
measures installed CJS/ESM compatibility serialization on real live objects. No
native-text result will be presented as object stringify acceleration. Two native
wrapper validation/use races are fixed and independently tested: text batch
snapshots and captured option limits. Schema2 verifies packed/installed/loaded
runtime bytes and real binary architecture headers. A host-only candidate must
fail the combined gate. Hostedplatform execution remains an explicit release
blocker; local fullchecks and fresh audits cannot substitute for it.

## Current local readiness outcome
Source757bc26 validation and sourcefc006f9 final documentation candidate are
verified on Windows Node22/24. Installed public APIs show no robust repeated
>=10% compatible stringify gain on seven real inputs; separate native text and
object-conversion results have explicit workload boundaries. Validation races
fixed without compatibility traversal changes. RD-PACK/RD-DOCS final evidence
closure does not satisfy R4-PACKAGE/P7-TARGETS: actual three-target combined
artifact installation is blocked by unavailable runners. Keep advanced features
deferred and prioritize those runtime/release gates over new APIs.
