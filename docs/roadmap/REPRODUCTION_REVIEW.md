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

## Coverage remaining

This milestone reproduces normalized lock/API, source-byte variants, Unicode,
tiny/real batches, single-identity real-document cache, and text competitors.
It does not independently reproduce old tiny/deep/wide text measurements,
ordinary object/native-roundtrip matrix, all 12 shorter synthetic/context rows,
selective extraction, cold startup, Rust-only stage timings or the historical
pre-scanner baseline. Their old evidence is preserved but not newly verified by
this agent. CPU/RSS are present in new raw files, not allocator counts or isolated
peaks. Further timing windows must be coordinated with tests/profiling/builds.
