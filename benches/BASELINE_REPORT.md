# Local release-addon benchmark evaluation

Historical source-specific evidence. Current installed public API measurements
and API boundaries are in [performance by API](../docs/performance.md).

Measured 2026-10-19 UTC at commit `9c4a1fe4ef1a525ae97b5368ed4dd9b7d4f24d1c`, Windows x64 10.0.26300, Node v24.20.0, V8 13.6.233.17-node.53, 12th Gen Intel(R) Core(TM) i7-12700K, rustc 1.98.1 (48a229cea 2026-09-01), 32 GiB RAM. The lead built the actual addon in Cargo release mode before these runs. Native artifact SHA-256: `2b5bc47096a4ee7f3430442bf8c42aba6f1cbe9d12d150a92b87e5f688ff52ad`. Other operating systems are UNVERIFIED.

The compatibility API stays close to upstream. The native API provides a measurable benefit for some already-serialized JSON workloads, but loses heavily on deep and Unicode-heavy data. Converting ordinary JS objects to text before native processing is slower than the direct upstream object serializer on every fixture in this matrix except the small batch-array fixture. No general Rust speedup is supported.

Raw evidence:

- [Full matrix, 7 repetitions per cell, 35 ms target](results/2026-10-19T00-00-39-680Z-30968.json): 102 cells, all exact-output checks passed.
- [Targeted confirmation, 9 repetitions per cell, 100 ms target](results/2026-10-19T00-01-33-156Z-10332.json): 30 cells, all exact-output checks passed.
- [Batch/cache confirmation, 9 repetitions per cell, 100 ms target](results/2026-10-19T00-02-16-315Z-17604.json): 6 cells, all exact-output checks passed.

Earlier baselines are preserved with contamination and missing-dependency annotations in [results/NOTES.md](results/NOTES.md). Reproduce with `node benches/run.cjs`; set the exact `configuration` environment overrides recorded in each raw report (null means unset). Source, fixture, native artifact and dependency hashes/versions are recorded. Full fixture provenance and licenses are in [data/manifest.json](data/manifest.json).

## Confirmed object-input API

Rates are median operations/second. Public stringify is the JavaScript compatibility implementation. Native roundtrip includes JSON.stringify conversion on every operation. Relative percentages are rate changes versus direct upstream serialization.

| Workload | Upstream | Public stringify | Public change | Native roundtrip | Roundtrip change |
|---|---:|---:|---:|---:|---:|
| tiny | 1,727,602 | 1,749,612.9 | +1.3% | 1,237,722.6 | -28.4% |
| dependency-lock | 1,968.1 | 1,964.5 | -0.2% | 1,453.2 | -26.2% |
| public-api-data | 169.1 | 164.9 | -2.4% | 129.8 | -23.2% |
| deep | 42,741.8 | 43,548.4 | +1.9% | 10,194.3 | -76.1% |
| wide | 4,151.7 | 4,153 | +0.0% | 2,230.1 | -46.3% |
| unicode | 18,496.1 | 18,714.5 | +1.2% | 3,903.5 | -78.9% |

All confirmed public-stringify cells meet the provisional <=5% regression gate. Differences of a few percent are similar to observed sample and between-run variability and should not be advertised as wins.

## Confirmed pre-existing text input

The equivalent JS operation is JSON.parse(input) followed by the pinned upstream serializer. Every timed native result exactly matches that output on these fixtures, whose inputs were produced by JSON.stringify outside timing. The general native text API preserves scalar token spellings and is not interchangeable with JS serialization for arbitrary JSON text.

| Workload | JS parse + upstream ops/s | Native text ops/s | Rate change | Native MAD | Native latency |
|---|---:|---:|---:|---:|---:|
| tiny | 1,137,699.2 | 1,398,832.6 | +23.0% | 0.7% | 0.7 us |
| dependency-lock | 1,333.7 | 1,781.1 | +33.5% | 0.8% | 561.5 us |
| public-api-data | 137.8 | 171.6 | +24.6% | 0.8% | 5826.2 us |
| deep | 31,065.5 | 10,632 | -65.8% | 0.5% | 94.1 us |
| wide | 2,531.1 | 3,341.7 | +32.0% | 1.4% | 299.2 us |
| unicode | 13,073.5 | 4,316.4 | -67.0% | 1.6% | 231.7 us |

The >=10% native-text gate is met locally on the real TypeScript dependency lock and JSONPlaceholder service backing dataset, plus tiny/wide synthetic data. Deep and Unicode workloads fail the performance gate. Source inspection suggests repeated subtree validation/parsing in the RawValue implementation and UTF-16 key-comparator work as bottleneck candidates; these are hypotheses, not profiler findings. Profiling and a once-parsed architecture experiment remain follow-up work. Keep native text explicit and do not route arbitrary object-input serialization to it automatically.

## Full matrix and competitors

All figures below are median ops/s from the shorter exploratory matrix. JSON.stringify is included only as context; it does not promise equivalent stable key ordering. Competitor compatibility is verified only for these particular fixtures. safe-stable-stringify 2.5.0 and fast-stable-stringify 1.0.0 are not assumed to match the full upstream API.

| Workload | JSON.stringify context | Upstream | safe-stable | fast-stable | Public stringify | Native text |
|---|---:|---:|---:|---:|---:|---:|
| tiny | 9,053,527.1 | 1,780,290.4 | 3,049,716.1 | 2,019,846.8 | 1,698,230.6 | 1,588,907.8 |
| upstream-api-fixture | 296,276 | 63,094.9 | 81,244.9 | 68,136.5 | 63,279.3 | 64,460.7 |
| application-config | 646,945.2 | 124,918.4 | 189,033.5 | 145,012.6 | 127,131.7 | 136,066.1 |
| dependency-lock | 8,739 | 1,924.6 | 2,658.2 | 2,109.2 | 1,939.7 | 1,874.5 |
| public-api-data | 582.8 | 167.9 | 233.4 | 178 | 170.7 | 172.4 |
| deep | 197,339.6 | 43,310.9 | 83,101.5 | 54,741.6 | 44,347.2 | 10,702.2 |
| wide | 7,868.8 | 4,051.8 | 4,635.6 | 4,329.7 | 3,893.2 | 3,239.9 |
| unicode | 40,805.2 | 17,888.6 | 16,361.5 | 19,085.1 | 18,509.8 | 4,275.4 |
| large-string | 9,270.3 | 5,585.4 | 5,173.2 | 5,481.3 | 5,510.7 | 5,005.7 |
| record-array | 7,731.2 | 1,428.4 | 2,225.5 | 1,700.6 | 1,439.7 | 1,675 |
| backend-payload | 7,761.5 | 1,390.2 | 2,150.5 | 1,625.7 | 1,441.3 | 1,340.3 |
| batch-32 | 363,803.4 | 43,257.5 | 88,958.3 | 56,916.5 | 44,499.7 | 55,524.7 |

Existing JavaScript competitors beat this project's compatibility wrapper on many ordinary-object datasets. This project cannot honestly claim to be the fastest stable serializer.

## Batch and cache confirmation

Each batch operation handles 32 documents. Both batch candidates include identical serialization of the returned list of strings, so result consumption and output checking are equivalent.

| Method | Batches or calls/s | Items/s | MAD |
|---|---:|---:|---:|
| batch-public | 36,574.5 | 1,170,385 | 1.6% |
| batch-upstream-loop | 39,416.9 | 1,261,340.3 | 0.7% |
| batch-text-native | 34,028.6 | 1,088,914.6 | 2.3% |
| batch-text-upstream-loop | 26,105.9 | 835,389.4 | 1.4% |
| cache-hit | 87,862,088.1 | 87,862,088.1 | 1.2% |
| cache-miss | 44,229.1 | 44,229.1 | 3.1% |

Public JS batch changes throughput by -7.2% relative to the upstream loop, failing the speed gate; it is an ordered convenience API, not an acceleration claim. Native pre-existing-text batch changes throughput by +30.3% versus parsing/serializing each document in JavaScript. This does not isolate boundary-crossing savings; it compares the complete operations.

Cache-hit returns one already-computed string for unchanged object identity and explicit version. Cache-miss increments the version each call and performs real serialization. Their large difference is expected skipped work, not faster serialization; the caller must update versions after every serialization-visible mutation. Hit timings include the benchmark's checksum overhead and can approach the harness overhead floor. No automatic mutation detection is promised.

## Memory, CPU, startup and blocking

For the JSONPlaceholder full-matrix cells, lifetime process maximum RSS was 85.2 MiB for native text versus 205.4 MiB for parse+upstream. These are isolated process maxima including V8, fixture setup, warmup and loading; they are not native allocations or per-call peaks. The raw reports also retain sampled RSS/heap, CPU user/system microseconds, throughput and every timing sample. Allocations are NOT MEASURED.

Median fresh-process require durations (OS cache potentially warm, excluding process startup): ./upstream/fast-json-stable-stringify 3.54 ms; ./js/index.cjs 3.78 ms; ./native/binding.js 4.99 ms. The JS wrapper loads native code lazily, so addon loading is measured separately.

Reported latency is the reciprocal of median sample throughput: an amortized per-operation duration, not individually timed call percentiles. All APIs measured here are synchronous and block the event loop during their work. Timer probes are burst durations plus scheduling delay, not per-request p99 latency. The checksum reads each output length and middle code unit, which may force V8 concatenated strings to flatten; this output-consumption cost is included for all candidates. The 16-operation clock-check batch can overshoot target sample durations on large inputs; actual elapsed time is recorded. No async or streaming responsiveness claim is made.

## Validation and limits

`node --test benches/harness.test.cjs` passed 4/4: retained fixture bytes/hashes/licenses, deterministic dataset generation, validated worker measurements, and the five-repetition minimum. These checks test the benchmark harness; the project's separate Rust, binding, differential and type tests determine API correctness. Runs were serial with builds/tests paused, but scheduler state, power management and GC remain uncontrolled. Measurements are local evidence with MAD summaries, not confidence intervals or universal production performance guarantees. Longer randomized-order and workload-specific runs are recommended before deployment decisions.
