# Local release-addon benchmark evaluation

The optimized native text engine improves the measured real API and dependency-lock text workloads. Deep-input performance improved substantially after removing repeated subtree parsing. Unicode-heavy input remains much slower than JavaScript. Ordinary object inputs and small batches still need workload-specific decisions; no automatic native routing is justified.

Measured 2026-10-19 UTC, Windows x64 10.0.26300, Node v24.20.0, V8 13.6.233.17-node.53, 12th Gen Intel(R) Core(TM) i7-12700K, rustc 1.98.1 (48a229cea 2026-09-01), 32 GiB RAM. Optimized commit: `28326e78193cc29119a30683afb6aeaeac09556f`; native SHA-256: `117e5a5b6fade6a31a012586b982dd5eddd378fc9e112a981ed1259bd729f07e`. Baseline commit: `9c4a1fe4ef1a525ae97b5368ed4dd9b7d4f24d1c`. The actual release-mode addon is used, including JS/native conversion and return costs. Other platforms are UNVERIFIED.

## Evidence and reproduction

- [Full optimized matrix (7 x 35 ms)](results/2026-10-19T00-06-17-364Z-30392.json): 102 cells, all exact-output checks passed before timing.
- [First optimized confirmation (9 x 100 ms)](results/2026-10-19T00-07-07-143Z-9768.json): 30 cells, all exact-output checks passed before timing.
- [Second optimized confirmation (9 x 100 ms)](results/2026-10-19T00-07-51-677Z-8716.json): 30 cells, all exact-output checks passed before timing.
- [Batch/cache confirmation (9 x 100 ms)](results/2026-10-19T00-08-36-762Z-25396.json): 6 cells, all exact-output checks passed before timing.
- [Same-native batch/loop comparison (9 x 100 ms)](results/2026-10-19T00-08-59-583Z-26116.json): 3 cells, all exact-output checks passed before timing.
- [Before-optimization confirmation (9 x 100 ms)](results/2026-10-19T00-01-33-156Z-10332.json): 30 cells, all exact-output checks passed before timing.

[BASELINE_REPORT.md](BASELINE_REPORT.md) preserves the original findings and failures. Earlier runs remain in [results/NOTES.md](results/NOTES.md), including missing-dependency and concurrent-build caveats. Run `node benches/run.cjs` with the exact `configuration` environment values in each report (null means unset). Metadata includes source/native/fixture hashes, package versions, machine, Git dirty state and commit. The benchmark harness self-tests pass 4/4 with `node --test benches/harness.test.cjs`.

## Before/after optimization

Median ops/s for identical pre-existing-text operations. Before and both after confirmations use nine 100 ms samples plus 200 ms warmup. Columns show both independent runs instead of hiding between-run variation.

| Workload | Before native text | After run 1 | After run 2 | Change, run 2/before | After run 2 MAD |
|---|---:|---:|---:|---:|---:|
| tiny | 1,398,832.6 | 2,265,672.7 | 2,261,414 | +61.7% | 1.4% |
| dependency-lock | 1,781.1 | 3,277.1 | 3,376.9 | +89.6% | 4.3% |
| public-api-data | 171.6 | 231.7 | 230.6 | +34.4% | 1.9% |
| deep | 10,632 | 70,884.4 | 72,084.2 | +578.0% | 0.9% |
| wide | 3,341.7 | 4,223 | 4,262.3 | +27.5% | 1.4% |
| unicode | 4,316.4 | 3,955 | 4,432.3 | +2.7% | 0.7% |

The single-validation scanner removes the old repeated RawValue subtree reparsing. The [Rust stage profile](results/2026-10-19-single-pass-stage-profile.txt) separately measured original-text real API validation at 0.57 ms, scan/sort/drop at 2.47 ms and emission of a prebuilt tree at 0.49 ms, with whole-engine median 3.65 ms. Stage measurements are Rust-only and exclude napi conversion; their input retains original whitespace and differs from the minified public-API benchmark input. Allocation and sorting work in scan/sort/drop remains the main measured stage; the experiment does not attribute individual allocation counts.

## Equivalent pre-existing-text comparison

The JS baseline parses the input and applies the pinned upstream serializer. Inputs are normalized with JSON.stringify outside timing, so exact output equality is valid on these fixtures. General native text semantics preserve scalar token spelling; arbitrary JSON text is not equivalent to JS object serialization.

| Workload | JS parse + upstream | Native run 1 | Native run 2 | Run 2 vs JS | Native latency, run 2 |
|---|---:|---:|---:|---:|---:|
| tiny | 1,178,071.3 | 2,265,672.7 | 2,261,414 | +92.0% | 0.4 us |
| dependency-lock | 1,337.6 | 3,277.1 | 3,376.9 | +152.5% | 296.1 us |
| public-api-data | 137 | 231.7 | 230.6 | +68.4% | 4336.5 us |
| deep | 31,469.6 | 70,884.4 | 72,084.2 | +129.1% | 13.9 us |
| wide | 2,485.9 | 4,223 | 4,262.3 | +71.5% | 234.6 us |
| unicode | 13,134.2 | 3,955 | 4,432.3 | -66.3% | 225.6 us |

The provisional >=10% native-text improvement gate is met in both longer confirmations on real TypeScript dependency metadata and JSONPlaceholder service backing data, and on tiny/deep/wide synthetic fixtures. Unicode fails the gate in both runs; do not recommend this API for Unicode-heavy input based on these measurements. The 35 ms exploratory dependency-lock cell measured 2,483.8 ops/s versus 3,277.1/3,376.9 in longer confirmations. Warmup/run-duration, allocator and scheduling effects are not isolated; this observed variation limits precision of any single percentage claim.

## Ordinary JS object input

Latest confirmation medians. Public stringify keeps upstream JS semantics. Native roundtrip includes JSON.stringify on every call, so both conversion and native return costs are measured. Roundtrip values match upstream for these fixtures; this is not a full JavaScript-semantics compatibility promise.

| Workload | Upstream | Public stringify | Public vs upstream | Native roundtrip | Roundtrip vs upstream |
|---|---:|---:|---:|---:|---:|
| tiny | 1,752,624 | 1,730,374.6 | -1.3% | 1,603,067.9 | -8.5% |
| dependency-lock | 1,978.3 | 1,987.6 | +0.5% | 2,217.9 | +12.1% |
| public-api-data | 168.6 | 166.4 | -1.3% | 167.3 | -0.7% |
| deep | 43,749 | 41,605.1 | -4.9% | 50,984.8 | +16.5% |
| wide | 4,080.9 | 4,202.7 | +3.0% | 2,551 | -37.5% |
| unicode | 18,616 | 18,905.3 | +1.6% | 4,024.5 | -78.4% |

All public-stringify cells in both longer confirmations meet the provisional <=5% regression gate. The shorter full-matrix deep/public cell was 11.9% below upstream; the longer repeats do not reproduce that regression. Small differences are sensitive to JIT, GC and scheduling and should not be marketed as improvements. Native roundtrip wins on some fixtures and loses on others, including wide/Unicode inputs. Keep the ordinary compatibility API in JavaScript.

## Full matrix and competitors

Shorter full-matrix medians in ops/s. JSON.stringify is context only and does not promise stable ordering. safe-stable-stringify 2.5.0 and fast-stable-stringify 1.0.0 match these fixtures, but their complete semantics differ from the upstream compatibility API.

| Workload | JSON.stringify context | Upstream | safe-stable | fast-stable | Public stringify | Native text |
|---|---:|---:|---:|---:|---:|---:|
| tiny | 9,071,597.6 | 1,785,566.5 | 2,998,158.7 | 2,015,605.6 | 1,740,411.5 | 2,293,430.6 |
| upstream-api-fixture | 296,497.3 | 62,827.6 | 81,369.6 | 66,899.5 | 62,173.3 | 116,672.2 |
| application-config | 655,743.3 | 127,290.8 | 188,159 | 142,904.8 | 127,616.4 | 234,209.1 |
| dependency-lock | 9,092 | 1,891.9 | 2,728 | 2,257.2 | 1,939.2 | 2,483.8 |
| public-api-data | 557.2 | 169.1 | 238.6 | 176.5 | 167.7 | 232.1 |
| deep | 197,393.5 | 42,534.4 | 81,984.2 | 53,215.4 | 37,457.8 | 70,205.6 |
| wide | 8,388.2 | 4,113.1 | 4,562.3 | 4,243.5 | 4,256.7 | 4,178.5 |
| unicode | 43,679.7 | 18,227.5 | 16,638.9 | 18,758.4 | 19,223.2 | 4,467.1 |
| large-string | 9,315.1 | 5,238.7 | 5,605.2 | 5,636.8 | 6,127.9 | 5,621.4 |
| record-array | 7,503 | 1,435.4 | 2,226.9 | 1,643.8 | 1,438.3 | 1,793.3 |
| backend-payload | 7,630 | 1,397.4 | 2,090.7 | 1,577.6 | 1,457.8 | 2,150.4 |
| batch-32 | 373,244.4 | 44,386.4 | 93,316.5 | 54,893.5 | 43,561.9 | 94,558.6 |

Existing JavaScript competitors beat the compatibility wrapper on many ordinary-object workloads. No claim to be the fastest stable serializer is supported. Fixture sources, dates, hashes, structure and retained MIT/Apache notices are in [data/manifest.json](data/manifest.json). Real TypeScript lock/config files and JSONPlaceholder service backing data are supplemented by deterministic synthetic isolation cases. JSONPlaceholder intentionally contains fictional service data, not private user data.

## Batch and cache

Batch input contains 32 tiny documents; both candidates include identical conversion of the returned string list to a string for consumption. The final same-engine comparison separates native-engine benefits from batching benefits.

| Method | Batches/s | Documents/s | MAD |
|---|---:|---:|---:|
| batch-text-native | 48,922.4 | 1,565,517.7 | 0.4% |
| batch-text-native-loop | 50,527.8 | 1,616,890 | 1.6% |
| batch-text-upstream-loop | 25,956.7 | 830,612.9 | 0.4% |

Native batch is -3.2% versus calling the same native engine 32 times, and +88.5% versus JavaScript parse+upstream. The first result provides no evidence of a boundary-amortization speedup on this workload. Treat batching as an ordered convenience with a single call, not a guaranteed throughput optimization. No large-document batch extrapolation is justified.

| Cache/JS batch method | Calls or batches/s | MAD |
|---|---:|---:|
| batch-public | 36,408.5 | 1.7% |
| batch-upstream-loop | 38,777.5 | 2.4% |
| cache-hit | 87,615,277.1 | 1.1% |
| cache-miss | 44,262.5 | 0.7% |

Public JS batch is -6.1% versus the upstream loop and fails a speed-improvement gate. Cache-hit returns an already-computed string for the same identity/version; cache-miss changes the explicit version and performs real serialization. The large gap reflects skipped work, not a faster serializer. Callers must update versions after every serialization-visible mutation. Cache-hit measurement approaches harness/checksum overhead and is not an automatic deep mutation-detection claim.

## Memory, CPU, startup and blocking

For the optimized full-matrix real API cells, lifetime process maximum RSS was 87.5 MiB for native text versus 205.3 MiB for parse+upstream. These process maxima include V8, fixture loading, warmup and require; they are not serializer-only peaks or allocation counts. The raw JSON retains sampled heap/RSS, CPU user/system microseconds, output MiB/s and every sample. Allocations are NOT MEASURED.

Median fresh-process require times, potentially warm OS disk cache and excluding process startup: ./upstream/fast-json-stable-stringify 3.60 ms; ./js/index.cjs 3.87 ms; ./native/binding.js 5.07 ms. The wrapper loads native lazily, so binding require is recorded separately.

Latency is the reciprocal of median sample throughput: an amortized per-operation duration, not individually timed call percentiles. All measured APIs are synchronous. Timer probes cover benchmark burst blocking plus scheduling and do not establish per-request p99 latency or async responsiveness. The 16-call timer-check batch can overshoot the target duration; actual elapsed time is used. The checksum touches length and a middle UTF-16 code unit, which may flatten V8 ropes; that output-consumption cost is included for all methods.

Runs were serial and isolated from builds/tests, but CPU placement, thermal state, power mode and GC remain uncontrolled. Within-run MAD is not a confidence interval and does not capture all between-run differences. These local measurements justify retaining the explicit native text API and the scanner optimization while preserving the Unicode caveat; deployment and cross-platform claims require additional evidence.
