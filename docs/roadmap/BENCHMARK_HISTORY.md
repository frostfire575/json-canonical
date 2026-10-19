# Benchmark history

No measurements existed at bootstrap. All following raw results are preserved
without overwriting under benches/results. Full tables: benches/REPORT.md;
original architecture report: benches/BASELINE_REPORT.md.

| Milestone | Commit | Command/config | Raw artifact | Finding |
|---|---|---|---|---|
| Initial upstream baseline | pre-MVP | node benches/run.cjs,7x35ms |2026-10-18T23-55-47-261Z-23840.json|tiny1.73Mops/s,lock1938ops/s; no native claim|
| Baseline full |9c4a1fe|same,102 cells|2026-10-19T00-00-39-680Z-30968.json|real text gains, deep/Unicode native regressions|
| Baseline confirm |9c4a1fe|9x100ms,6 workloads|2026-10-19T00-01-33-156Z-10332.json|native deep/Unicode65–67%below parse+upstream|
| Scanner full |28326e7|7x35ms,102 cells|2026-10-19T00-06-17-364Z-30392.json|all exact output checks pass|
| Scanner confirm1 |28326e7|9x100ms,6 workloads|2026-10-19T00-07-07-143Z-9768.json|deep regression fixed, real gains retained|
| Scanner confirm2 |28326e7|same|2026-10-19T00-07-51-677Z-8716.json|lock3377vs1338;API231vs137;Unicode4432vs13134ops/s|
| Same-native batch |28326e7|9x100ms,batch32|2026-10-19T00-08-59-583Z-26116.json|native batch3.2%slower than repeated native calls|
| Selection confirm1 |991e97c|9x100ms,6workloads4methods|2026-10-19T00-14-09-631Z-7976.json|lock/wide gains,API/Unicode/deep/tiny losses|
| Selection confirm2 |991e97c|same|2026-10-19T00-14-43-812Z-19944.json|lock6789vs4556,API513vs681ops/s|

All figures include public API conversion/return costs. Text/sorting comparisons
use pre-existing normalized JSON; JS baseline is JSON.parse+upstream. Selection
raw text and parsed scalar outcomes are measured separately. JSON.stringify-only
is contextual. Each raw JSON stores actual configuration,environment,commit,hashes,
every sample,MAD,CPU,RSS and blocking probes. Earlier contaminated runs are retained
and explicitly excluded in NOTES.md/INDEPENDENT_REVIEW.md. Allocation counts are
NOT MEASURED. Rust stage profile is separate Rust-only evidence, not npm throughput.

## Expanded independent reproduction and profiling, 2026-10-19
404 independently measured cells across real fixtures and synthetic controls;
commands, source snapshots, samples and identity in REPRODUCTION_REVIEW.md.
Warmup sensitivity corroborates normalized-lock native3268/3318 vs1373/1358ops/s.
Latin1 native7438/7491 vs92245/90744; real CLDR native6750/6780 vs4835/4824.
Real batch sizes1/8/32/128 lose3–33% versus same native repeated calls.
Real versioned-cache pools: misses3–5%slower,50%hits~1.8x,90%hits~7.3–7.7x.
These conditional cache results include the same mutation/version schedule.

Private profiling raw files in benches/profiling/results, not production claims:
00-48-54-632Z-7208-batch: real32-record batch30.160us vs loop28.315us;
input conversion5.591us, output clone/conversion5.564us, stored engine14.891us.
Collect25.410us vs preallocated25.965us: no demonstrated benefit from preallocation.
00-49-29-827Z-10412-allocations: batch32 preallocation saves exactly3 reallocations
on every tested input; still256/11296 core reallocations for CLDR/lock respectively.
00-49-30-013Z-24432: validation10.644us and scan/sort/drop24.171us for Unicode.
No V8 allocation counts or internal call-stack profile. No production optimization
accepted at this checkpoint. Prior reports saying allocations NOT MEASURED apply
only to their original public-API benchmark evidence, not this isolated Rust run.

Accepted output candidate2: see OUTPUT_BENCHMARK_REVIEW.md for160Node24cells,
8targeted confirmation and40Node22cells, all exact checks pass. Native SHA256
96ba87bcc9a76f9c2cce21cede7ef74ea10e69b147a69b5435536f1ce81c5f86.
RealCLDR matched Node24old6870/6840,new9082/8946; Node22old6532/6666,new8799/8946.
DenseUnicode Node24old4541/4479,new8258/8506, still belowJS13260/13377.
Full-count candidate1FAILED sparse gate; retained all116cells. Predicate-only
profiles00-55-33-341Z-25732 and00-56-25-381Z-2764 isolate routing overhead.
Exact commands/manifests and raw allsamples/source snapshots live in reproduction/.
No compilation/tests ran during independent timing. No productionbatch speedclaim.

## Installed public API evidence, source757bc26, 2026-10-19
114 cells on Windows11 x64/i7-12700K/Node24.20.0/Rust1.98.1;1s warmup,
9x100ms minimum samples, two shuffled fresh-process runs. Packed candidate
readiness-benchmark-01 SHA256
66e82b265c2e3dfb3edfe7220c1b2c63a0506e453612d7c8884f95f7e7667017.
All before/after exact comparisons PASS. Raw JSON in benches/public-api/results:
- 2026-10-19T01-32-18-492Z-7352.json:84object cells, seven real inputs,
  installed CJS/ESM stringify/alias, upstream and full object-native roundtrip.
- 2026-10-19T01-35-24-055Z-14936.json:6batch cells,32real comments.
- 2026-10-19T01-36-28-139Z-19788.json:24existing-text/selection cells.

No compatible export repeats >=10% gain on any fixture. Actual public CJS
lock1879/2162 vsupstream2067/2020; CLDR7958/8000 vs7620/7894ops/s.
Full object-native lock2361/2396; CLDR6186/6213 (19-21%slower vsupstream).
Existing-text lock3558/3451 vsparse+upstream1427/1393; CLDR9569/9311
vs5165/5110. These are different APIs, not universal stringify speedups.
Native batch34913/34898 vsold34629/35020 and current-native-loop36397/37643
batches/s: no meaningful security-fix regression;4-7% slower than repeated calls.
Selection lock7024/6999 vs4980/4956; fullAPI535/527 vs713/712; CLDR8762/8680
vs17497/17110. CPU/RSS/maxRSS are process observations, not allocation counts.
PUBLIC_API_PERFORMANCE_REVIEW.md has all CJS/ESM aliases, median/MAD and variability;
frozen runners, source/license/packed/installed/loaded hashes and samples retained.
Commands and machine metadata are embedded in each raw report. No new Node22 or
foreign-platform performance measurements; prior cache and output findings remain
historical evidence. Final runner6selftests and both syntax checks PASS.

### Final artifact linkage
Sourcefc006f9 documentation candidate readiness-final-01 tar SHA256
b424ebbc68d01fe6031ed40d8d17ecc9e1f459cce5bd84f5296cba042956957a.
All12runtime/package/license manifest hashes match measured readiness-benchmark-01;
README/performance docs updated, tar identity differs. Independent extracted/loaded
native SHA and compiled DLL also match. Thus114current measurements apply to the
final runtime without silently reusing an older wrapper. No new timing fabricated.
Evidence: docs/roadmap/evidence/readiness-final-01/runtime-equivalence.json and
independent-review-*.json. Four final installed consumer checks PASS on Windows.
Actual combined/foreign-platform execution NOTRUN; output/cache historical reports
retain their original source/environment boundaries.

## Independent native JSON-text positioning evidence, 2026-10-19
162completed exact-checked cells on actual installed readiness-final-01 candidate,
SHA256b424ebbc68d01fe6031ed40d8d17ecc9e1f459cce5bd84f5296cba042956957a;
loadedrelease96ba87... unchangedruntime. Windows11/i7-12700K/Node24.20/Rust1.98.1.
Three shuffled serial passes,1s warmup,9x>=100ms per cell, full public API conversion
and returned string consumption included; setup/archive/fixture work outside timing.
- Main108: benches/native-text-verification/results/2026-10-19T09-56-55-718Z-33544.json.
- Paired direct-field54: results/2026-10-19T10-01-50-243Z-33224.json in samefolder.
Both retain rawsamples, medians/MAD, CPU/RSS/heap/maxRSS and machine/source/runtime
identities, frozenrunner and compressed complete input/output corpus. Lead reran
verify-evidence.cjs on each:108PASS/54PASS. Seven harness selftests PASS22/24
(independentreviewer), leadNode24sevenPASS including45untimed operationchecks.

Original source sorting native vsparse+upstream, run1/2/3ops/s:
lock2392/2397/2339 vs1017/774/1090; config175804/172713/177697 vs66546/69824/74401;
API178/172/178 vs115/106/112; CLDR6698/6422/5975 vs3988/3937/3972;
upstreammock83997/84469/84312 vs33452/33233/35475. All5original files win repeatedly;
normalizedcontrols remain separately labeled, never replaceoriginal bytes.
JSlockpass2has16.54%MAD; retained, no best-run ratio universalclaim.
API native5.61-5.80ms/op,226.6-234.2inputMiB/s. WholeworkerpeakRSS134.0-136.3MiB
vsJS252.5-258.7 includes setup/oracle/archive/warmup/GC; NOT isolatedallocation
counts or a general lower-memory guarantee.

Direct-field selection normalizedlock5581/5602/5912 vs3671/3599/3804ops/s
(~52-56%throughput gain); originallock3741/3717/3698 vs3436/3278/3499
(~6-13%, not repeated>=10%). All other direct controls native slower, including
API323/324/349 vs512/549/529 andCLDR4993/5022/5532 vs11809/11634/12740.
Generic pointer interpreter baseline preserved separately, not mislabeled direct
lookup. No general extraction, liveobject, Node22 or foreignplatform speedclaim.
NATIVE_TEXT_REVIEW_2.md has all9variants, latency/throughput/memory and exactcommands.
