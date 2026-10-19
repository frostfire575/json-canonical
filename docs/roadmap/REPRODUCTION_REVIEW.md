# Independent performance reproduction — 2026-10-19

Review performed by a separate benchmark agent, with no implementation edits.
Initial release build and ordinary validation finished before timing. Other
agents paused CPU-intensive tests, builds and profiling during both timing runs.
This is Windows x64 local evidence; Linux/macOS execution remains UNVERIFIED.

## Historical evidence audit

The reported numbers are present in
`benches/results/2026-10-19T00-07-51-677Z-8716.json`:
native-text **3376.890747 ops/s**, upstream-from-text **1337.551575 ops/s**.
Their nine-sample MADs were 4.324% and 1.605%. Native samples ranged from 2385.3
to 3534.1 ops/s, progressing upward through early samples; 200 ms warmup did not
establish complete steady state. MAD is not a confidence interval.

Exact saved configuration:

```json
{"BENCH_REPS":"9","BENCH_SAMPLE_MS":"100","BENCH_DATASETS":"tiny,dependency-lock,public-api-data,deep,wide,unicode","BENCH_METHODS":"upstream,public-stringify,upstream-from-text,native-text,native-roundtrip"}
```

Historical commit was `28326e78193cc29119a30683afb6aeaeac09556f`, native SHA-256
`117e5a5b6fade6a31a012586b982dd5eddd378fc9e112a981ed1259bd729f07e`.
That exact historic binary was not used for current reproduction: current code
also includes selection and its compiled artifact has a different identity.
The raw historical report stores Git dirty state and source hashes; it omitted
`src/tree.rs` from its source-hash list, so the pinned commit is also necessary.

The historical benchmark input was **93,728-byte normalized JSON**, SHA-256
`5f8afda0d3a8190dd04d7561ef72ec6cd3abe74c45b1ba6a720b8dbfff7ac64e`.
The retained TypeScript source lockfile is **143,844 bytes**, SHA-256
`52b6c9bd0a26ef1b0fc27dfbfaa00df6a047cdddd587d07c4f6c1c3345faf5cf`.
`JSON.parse` and `JSON.stringify` normalization occurred outside timing. This is
a valid pre-existing minified-text workload, but cannot be described as unchanged
source bytes. The source itself is separately measured below.

Both historical functions receive identical normalized text. JS performs
`oracle(JSON.parse(text))`; native invokes the complete public
`api.stringifyJson(text)`. Thus JS parsing, stable serialization, wrapper checks,
napi input conversion, Rust execution and returned JS string conversion are
included. Exact output equality is checked before timing. Fixture loading and
construction are outside timing. The ordinary object-to-JSON conversion cost is
excluded from *both* text candidates. These operations are equivalent on the
verified fixtures, not on arbitrary token-preserving JSON (for example `1.00`).

## Independent runner and provenance

`benches/reproduction/run.cjs` does not import the previous runner or its datasets.
It validates all four retained fixture lengths, SHA-256 values and license texts
against `benches/data/manifest.json`, independently constructs isolation cases,
and compares exact output before measurement. Provenance/commit/Apache-2.0 and
MIT licenses are retained in that manifest and license files. No private data
was fetched. JSONPlaceholder comments are public fictional service data.

Each dataset/method/run uses a fresh child process; method order is shuffled with
a recorded deterministic seed. Two independent run orders, nine 100 ms samples,
300 ms warmup, observable output checksums, actual elapsed times, CPU times,
sampled RSS/heap and process maximum RSS are retained. Each output is consumed
using length and the middle UTF-16 character, matching the historical rope
flattening cost. Batch candidates include identical JSON.stringify of the
returned string array. JS object batch comparisons preparse inputs outside the
timed section; the separate text-oracle loop includes parsing each document.

The loaded `.node` file is observed through Node's actual module cache in **every
child**, rather than inferred from directory listing. Its SHA-256 is
`154d1683ec0db600a2053528c08d776ac123367fb9afee573cb173466c14e0a1`, identical
to `target/x86_64-pc-windows-msvc/release/stable_json_rs.dll`. There is no native
library override. Release profile uses thin LTO and one codegen unit. The lead
executed `pnpm check` before reproduction; the runner itself never builds.

Machine: Windows 11 Pro 10.0.26300 x64, i7-12700K (20 logical CPUs),
34,087,682,048 bytes RAM, balanced power plan, Node v24.20.0, V8
13.6.233.17-node.53, rustc/Cargo 1.98.1, napi CLI 3.10.8,
safe-stable-stringify 2.5.0, fast-stable-stringify 1.0.0. Git commit
`113a8eb79dbf7350d1f15a7e639d7a5e2492abee`; concurrent source-only test/CI/docs
edits are recorded in dirty state. No engine edits occurred during reproduction.
The runner's direct pnpm.cmd version probe returned UNAVAILABLE on Windows;
pnpm 12.10.1 was separately verified by the lead. Scheduling, thermal state and
GC remain uncontrolled; samples are local exploratory measurements.

## Reproduced measurements

Raw reports (append-only):

- `benches/reproduction/results/2026-10-19T00-27-21-010Z-30844-checks.json`: 34 exact checks.
- `benches/reproduction/results/2026-10-19T00-27-31-071Z-14360.json`: 68 measured cells, two run orders.
- `benches/reproduction/results/2026-10-19T00-29-13-292Z-29288.json`: eight longer-warmup cells.

All 76 measured cells first passed exact output checks. Rates below are median
ops/s; parentheses show within-run MAD percent. Runs remain separate.

| Text workload | JS parse + oracle run 1 / 2 | Native run 1 / 2 |
|---|---:|---:|
| TypeScript normalized lock, 93,728 bytes | 1321 (1.85%) / 1341 (1.31%) | 3242 (3.56%) / 3428 (1.20%) |
| TypeScript actual source, 143,844 bytes | 1298 (1.07%) / 1287 (1.45%) | 2530 (4.04%) / 2788 (2.14%) |
| JSONPlaceholder normalized, 1,085,130 bytes | 138.8 (0.44%) / 136.9 (1.11%) | 235.5 (0.97%) / 232.3 (0.96%) |
| JSONPlaceholder actual source, 1,378,184 bytes | 140.3 (1.45%) / 134.9 (2.60%) | 213.2 (1.62%) / 213.4 (1.37%) |
| Synthetic Unicode, 39,491 UTF-8 bytes | 11008 (10.53%) / 13214 (1.99%) | 4406 (0.56%) / 4485 (0.77%) |

The broad normalized-lock result reproduces: current native ~3.2–3.4k versus
~1.3k ops/s JS. **3377/1338 is not an invariant rate.** The independent source-byte
result is materially different from normalized text. Unicode loses strongly;
run 1 JS Unicode is noisy and is preserved without suppressing it.

One-second warmup sensitivity, same nine 100 ms samples and two run orders:

| Workload | JS run 1 / 2 | Native run 1 / 2 |
|---|---:|---:|
| Normalized lock | 1373 (0.92%) / 1358 (1.41%) | 3268 (0.92%) / 3318 (1.68%) |
| Unicode | 13254 (0.46%) / 13281 (2.04%) | 4541 (0.80%) / 4479 (1.67%) |

Longer warmup reduces some variation without changing either conclusion. This
does not isolate warmup causally from process/run order or host state.

| Batch of 32 | Native batch run 1 / 2 | Same native loop run 1 / 2 | Batch relative to loop |
|---|---:|---:|---:|
| Tiny synthetic documents | 50833 / 49475 | 49466 / 49784 | +2.8% / -0.6% |
| Real JSONPlaceholder comments | 27063 / 27209 | 28465 / 28456 | -4.9% / -4.4% |

Batching has no repeatable throughput win. The historical -3.2% tiny result
does not reproduce as a stable exact deficit, but its conclusion that a speed
benefit is unproven remains correct. JS public batch loses 3.6%/7.9% to the same
public loop on tiny input and 5.3%/6.3% on real comments. No API was removed.

Real API document explicit-version cache hit measured 88.2M/87.3M calls/s;
version-changing misses 166.0/168.1, versus upstream 167.6/167.3. These hit numbers
measure skipped serialization and approach checksum/harness overhead. They do
not measure version tracking, mutation detection or realistic mixed hit ratios.
Those remain a separate usefulness evaluation.

Equivalent text competitors also passed exact checks. On normalized lock,
safe-stable measured 1669/1651 and fast-stable 1422/1428; normalized real API
180/182 and 142/145. Both outperform upstream here, while native remains ahead.
Unicode safe-stable 11179/12194 and fast-stable 13149/13200 both beat native.
No general cross-library compatibility promise follows from fixture equality.

## Commands and runner metadata correction

```powershell
node --test benches/reproduction/reproduction.test.cjs
node benches/reproduction/run.cjs --check
node benches/reproduction/run.cjs
$env:REPRO_DATASETS='lock-normalized,unicode'
$env:REPRO_METHODS='oracle,native'
$env:REPRO_WARMUP_MS='1000'
node benches/reproduction/run.cjs
```

The four independent runner self-tests passed after both timing runs. The first
metadata-only correction preserves manifest source URLs (the measured runner
had shadowed them with source text before omitting that large field). Original
URLs remain verifiable in the retained manifest. `run-v1.cjs` preserves the exact
measured source SHA-256 `ee5cfc3eddbca908e843607625febe8710c83743d0e1c45a1021f5d9dcc4fed4`;
the runner correction changes no timed function. In v1 reports, `inputSha256`
hashes JSON.stringify(input), including quoting of single input strings; actual
fixture/normalized byte hashes are separate in `fixtures`. Raw reports are not
rewritten. The frozen v1 snapshot is evidence, not the maintained entry point.

## Coverage remaining at the initial milestone

This milestone reproduces normalized lock/API, source-byte variants, Unicode,
tiny/real batches, single-identity real-document cache, and text competitors.
It does not independently reproduce old tiny/deep/wide text measurements,
ordinary object/native-roundtrip matrix, all 12 shorter synthetic/context rows,
selective extraction, cold startup, Rust-only stage timings or the historical
pre-scanner baseline. Their old evidence is preserved but not newly verified by
this agent. CPU/RSS are present in new raw files, not allocator counts or isolated
peaks. Further timing windows must be coordinated with tests/profiling/builds.

## Expanded independent baseline milestone

Executed `node benches/reproduction/coverage.cjs` serially after the lead's
profiling completed. Core sources/addon were unchanged throughout. Snapshot
`benches/reproduction/run-82f314238fd4.cjs` preserves measured runner SHA-256
`82f314238fd4e69b7edd54960d0d66e0f9c3767edfc3c47eeda083a7aab3ad21`.
All **308 measured cells passed exact-output prechecks**, using two shuffled run
orders and nine 100 ms samples each. Coverage manifest:
`benches/reproduction/results/2026-10-19T00-38-53-424Z-coverage.json`.
Every table/rate/MAD is preserved in the generated append-only summary:
`benches/reproduction/results/2026-10-19T00-38-53-424Z-coverage-summary.md`.

The six groups cover all 12 historical ordinary-object shapes, their upstream,
public, native-roundtrip, safe-stable, fast-stable and contextual JSON.stringify
paths; missing tiny/deep/wide and other text shapes; all six selection paths with
both raw-text and JS-scalar outcomes; real array-element batches; realistic cache
mutation pools; and output-consumption sensitivity. Contextual JSON.stringify
has its own expected output and is explicitly marked non-equivalent to stable
serialization. Historical pre-scanner performance is not newly reproduced.

Additional text results support the old findings: tiny native 2.224M/2.228M vs JS
parse+upstream 1.182M/1.165M ops/s; deep 74,219/72,096 vs 31,555/31,336; wide
4306/4287 vs 2498/2462. Individual historical short-run numbers are not exact
constants; some shapes differ materially with longer warmup and measurement.

Object-to-native roundtrip is still workload dependent. Normalized lock measured
2192/2161 vs upstream 2016/2012 ops/s (below the 10% improvement gate); API
166.3/166.6 vs 167.4/164.3 (no useful win); Unicode 3995/4009 vs 18610/18775
(~79% loss); wide 2582/2569 vs 4179/4169 (~38% loss). No automatic object routing
is justified. Public JS serialization stays close to upstream; competitors win
many object shapes. No universal fastest-serializer claim is supported.

Selection reproduces the narrower scope: lock native 6776/6742 vs JS 4740/4688
ops/s (~43–44% gain, smaller than historical ~49%); API 508/512 vs 700/683
(~25–27% loss), deep 10.8k/10.7k vs 123.9k/122.8k (~91% loss), Unicode
11.1k/10.8k vs 45.6k/45.5k (~76% loss). Scalar outcomes have the same broad
conclusions; raw files retain exact figures and path contracts.

Direct consumption of every returned array element removes JSON.stringify of
the result list from both native batch candidates. This exposes batch overhead:

| Real comment count | Native batch relative to same-native loop, run 1 / 2 |
|---|---:|
| 1 | -31.8% / -32.6% |
| 8 | -11.1% / -12.5% |
| 32 | -8.8% / -8.3% |
| 128 | -3.2% / -7.0% |

These results further reject a blanket boundary-amortization speed claim. They
are public API comparisons including wrapper validation, input conversion and
returned array/strings. No speculative batch optimization was introduced.

Cache usefulness now has mixed workloads rather than only a repeated single
identity. Pools contain 32 or 128 real JSONPlaceholder comments. Every candidate
includes round-robin scheduling, explicit per-record versions and scheduled body
mutations. The cache is prefilled before timing; every scheduled mutation changes
the version, and an independent 400-step replay checks all results before each
measured cell. Planned hit ratios are 0%, 50%, 90% and 99%:

| Planned hit fraction | Cache versus repeated public serialization |
|---|---|
| 0% | 3–5% slower |
| 50% | approximately 1.8x throughput |
| 90% | approximately 7.3–7.7x throughput |
| 99% | approximately 27–29x throughput |

These conditional gains come from skipping work on known unchanged versions;
they do not provide mutation detection. High-hit results include scheduling,
version and checksum costs, while cache population remains outside timing.
Pools, payload size, hit ratios and invalidation contract matter in applications.

Length-only output consumption sensitivity uses one-second warmup: lock native
3421/3398 vs JS 1470/1474, Unicode native 4505/4487 vs JS 13644/13794 ops/s.
Compared with earlier flattening runs, JS lock benefits from avoiding output rope
flattening; native results also drift between runs. This is a sensitivity test,
not a causal decomposition or a reason to omit full output consumption from the
primary benchmark. Unicode's large loss remains.

The expanded six self-tests passed before these runs. A seventh later verifies
the newly retained CLDR fixture and density controls; final seven-test command
`node --test benches/reproduction/reproduction.test.cjs` passed on Windows
Node24.20.0 (seven tests, no failures). Those additional timing results are
recorded separately below when complete. New production changes have not yet
been measured by this agent at this baseline milestone.

## Encoding controls, real Unicode data and cold loading

Before production changes, added separately pinned CLDR Bengali localization
data and four isolated negative controls. `node --test
benches/reproduction/reproduction.test.cjs` passed seven tests, then
`node benches/reproduction/coverage.cjs encoding-controls` executed twenty exact
oracle comparisons/timing cells. Raw results:
`benches/reproduction/results/2026-10-19T00-46-20-529Z-25372.json`;
manifest/summary prefix `2026-10-19T00-46-20-489Z-coverage`.
Exact runner source is `run-c6202c807631.cjs`, SHA-256
`c6202c8076311a30e34722c236731d54af54ccab46a9f59903a598ff13db6f08`.
The loaded release addon remains the same `154d1683...` baseline.

CLDR source/Unicode-3.0 license, fixed commit and both exact file hashes are
verified from `benches/profiling/data/cldr-manifest.json` and copied into the raw
metadata. Original source is 25,897 bytes; normalized input is 19,086 bytes,
SHA-256 `36d0a6a25bef368aeaedf0d0422f4ab20132caabf37b7500b569dbcf9c0063a7`.
Fixture construction, normalization and checks happen before timing.

| Existing normalized JSON text | Native run 1 / 2 ops/s | JS parse + oracle run 1 / 2 ops/s |
|---|---:|---:|
| Real CLDR Bengali language names | 6750 / 6780 | 4835 / 4824 |
| `{value: 'é'.repeat(16000)}` | 7438 / 7491 | 92245 / 90744 |
| `{value: 'x'.repeat(50000) + '😀'}` | 11849 / 11913 | 12413 / 12204 |
| `{value: 'x'.repeat(50000)}` | 37096 / 37558 | 29857 / 29171 |
| `{value: 'বাংলা😀漢字é'}` | 1.840M / 1.815M | 1.970M / 1.968M |

The initial Unicode finding is workload dependent: the real localization fixture
already favors native, while Latin-1 and dense synthetic Unicode reveal large
native conversion losses. These controls are saved before implementation changes
for matched measurements, not as evidence of an optimization yet.

Executed `node benches/reproduction/cold-start.cjs`: five fresh processes per
module per round, two shuffled serial rounds, 30 successful require samples.
Raw: `benches/reproduction/results/2026-10-19T00-46-46-162Z-31476-cold-start.json`.

| Require target | Round 1 / 2 median ms |
|---|---:|
| Pinned upstream | 1.757 / 1.692 |
| Public wrapper (lazy native) | 2.089 / 1.913 |
| Actual native loader/addon | 3.227 / 3.182 |

These timers include require only, exclude Node process startup, and record
actual loaded native paths/hashes. OS disk cache may already be warm. They do
not establish cold-machine startup or per-request latency. Historical slower
require numbers are not reproduced exactly; environment/cache/run variation is
preserved rather than hidden. All baseline timing has now stopped; the lead may
build and test a candidate before a separately coordinated after window.
