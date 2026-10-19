# Independent native-output benchmark review

Current recommendation: **accept candidate 2 for the documented Windows
Node22/24 measured scope**. Candidate 1 remains rejected and preserved below.
This recommendation does not establish production readiness on unavailable
Linux/macOS hosts.

## Candidate 1 — REJECTED (2026-10-19)

Candidate 1 improves dense Unicode but fails the predeclared requirement of no
unexplained regression greater than 10%. **Do not accept this candidate
unchanged:** the sparse-Unicode negative control loses 15.5% and 16.4% throughput
across independent runs, with low within-run variation. Correctness checks pass;
the rejection is a performance-gate failure.

Candidate scope: only the native output representation changes. `src/output.rs`
returns the original Rust string for ordinary output, or a lossless napi-rs
`Utf16String` for output >=1024 UTF-8 bytes with at least 1/8 non-ASCII bytes.
`src/lib.rs` applies that helper to single and batch text outputs. Selection and
the compatibility serializer do not change. Raw JSON token spelling and sorted
content are unchanged. No automatic JS fallback is introduced.

The lead built and tested release output before the isolated timing window.
Independent benchmark harness tests passed **7/7** against the candidate before
timing. Independent output-review executable checks also ran separately; see
the lead's test evidence. The actual loaded addon SHA-256 in every measured
child was `bc95bc659185014f4c519c0af0af59c88e9920d2178d3be495f712d8adeacf86`,
matching the compiled target release artifact. The baseline addon was
`154d1683ec0db600a2053528c08d776ac123367fb9afee573cb173466c14e0a1`.

Exact runner source is retained at
`benches/reproduction/run-733864751133.cjs`, SHA-256
`73386475113318bc26659eaa7894ef44d5013a6537b5024e8af5f764e5693a2d`.
The metadata-only runner revision adds source hashes for output/selection/build
and root config files and embeds actual native source texts in every report.
No timed method or output-consumption semantics changed.

Command:

```powershell
node --test benches/reproduction/reproduction.test.cjs
node benches/reproduction/coverage.cjs encoding-controls candidate-text text-gaps candidate-roundtrip batch-elements
```

The isolated serial suite completed **116 measured cells**, each checking exact
output before timing, with two independently shuffled run orders and nine
100 ms samples. No production source changes or other CPU-intensive jobs ran
while the suite was active. The complete result is retained even though the
first group exposed a failure. All scheduled groups completed; no timing data
or failed experiments were discarded.

Manifest: `benches/reproduction/results/2026-10-19T00-52-20-913Z-coverage.json`.
All cell rates/within-run MADs are in its append-only `-coverage-summary.md`.
Each raw report includes actual elapsed time, every sample, CPU/RSS/heap,
fixture provenance/hashes, source contents/hashes and actual loaded addon.
Environment is the same Windows11 x64/Node24.20/i7-12700K machine described in
`REPRODUCTION_REVIEW.md`; remote platforms remain UNVERIFIED.

### Matched encoding-control comparison

Baseline: `2026-10-19T00-46-20-529Z-25372.json`.
Candidate: `2026-10-19T00-52-20-954Z-11408.json`.
Both use 300 ms warmup, 9 x 100 ms samples, identical data and full public
`api.stringifyJson(text)` calls. Input loading/generation is outside timing;
wrapper checks, napi input conversion, Rust work and returned JS strings are
included. Output consumption reads string length and a middle UTF-16 character.

| Existing JSON text | Baseline run 1 / 2 ops/s | Candidate run 1 / 2 ops/s | Change run 1 / 2 |
|---|---:|---:|---:|
| Real CLDR Bengali localization | 6750 / 6780 | 8585 / 8599 | +27.2% / +26.8% |
| Latin-1 (`é` x16000) | 7438 / 7491 | 22044 / 21972 | +196.4% / +193.3% |
| Sparse Unicode (50k ASCII + emoji) | 11849 / 11913 | 10007 / 9957 | **-15.5% / -16.4%** |
| ASCII string, 50k | 37096 / 37558 | 36588 / 36342 | -1.4% / -3.2% |
| Short Unicode | 1.840M / 1.815M | 1.904M / 1.935M | +3.5% / +6.6% |

Sparse-control baseline MADs: 0.64% / 0.96%; candidate MADs: 1.12% / 1.38%.
JS oracle controls remain broadly similar (12413/12204 baseline,
12284/11905 candidate ops/s), so the larger native deficit cannot reasonably be
dismissed as ordinary measured variation. Inspecting the helper shows a complete
byte-density count after detecting any non-ASCII output. That is a plausible
source of sparse-tail overhead; these end-to-end measurements alone do not
isolate that classifier's CPU cost. The lead will profile/refine it separately.

The CLDR fixture's pinned source/Unicode-3.0 license and exact normalized bytes
are recorded in `REPRODUCTION_REVIEW.md` and each raw report. This real Unicode
improvement passes the positive >=10% gate, but does not override a failing
negative control. Latin-1 remains slower than JS parse+oracle despite its gain.

### Other measured outcomes

Normalized lock/API/Unicode use one-second warmup. Candidate dense Unicode
measures 7984/7937 ops/s versus the earlier one-second baseline 4541/4479:
approximately **+76% / +77%**. It remains below the candidate JS parse+oracle
13386/12976, so no general native Unicode superiority is supported. Lock
3332/3356 versus earlier 3268/3318 is stable; API 234.0/229.1 is similar to prior
235.5/232.3. API's earlier independent baseline used 300 ms warmup, so its
before/after comparison is not strictly warmup matched.

All nine text-gap shapes were rerun (tiny/deep/wide/config/upstream fixture/large
string/record array/backend payload/32-record array). No additional >10%
negative-control regression appears in these paired medians. Dense Unicode
object-to-native roundtrip improves from 3995/4009 to 6624/6605 ops/s, but remains
far below ordinary JS upstream ~18.6–18.8k. Other roundtrip shapes stay near
their baseline medians. No automatic object routing is justified.

Real batches of 1/8/32/128 records still lose to the same native engine called
in a loop. Candidate batch-vs-loop deficits are approximately 34%, 14–15%,
8–10% and 2–10% respectively. Returning an array in one call still provides no
measured throughput advantage on these data. This optimization cannot support
a new batching speed claim.

Memory/CPU measurements remain process-wide observations, not allocation counts
or isolated serializer peaks. Cross-run drift, scheduling, thermal state and GC
are uncontrolled. Within-run MAD is not a confidence interval. Full raw data,
including every unfavorable result, is retained unchanged.

### Next required evidence

Reject candidate 1 as the final implementation. Profile and fix the classifier
without changing serialized bytes. Add mixed-prefix controls so a dense prefix
followed by a large ASCII tail cannot accidentally trigger an expensive route.
Compile, independently test, then coordinate a new isolated timing window and
repeat matched controls plus text/roundtrip/batch regression checks. No new
timings begin until the lead explicitly releases the CPU window.

## Candidate 2 — ACCEPT for measured scope (2026-10-19)

Candidate 2 replaces the unbounded classifier scan with four evenly spaced
256-byte samples. Each sample must contain at least 32 non-ASCII bytes before
the lossless UTF-16 route is selected. It retains the >=1024-byte minimum.
This is a bounded performance heuristic, not a JSON rule: both routes return
identical text. In particular, late dense Unicode can remain on the original
route when the sampled prefix is ASCII. No JS fallback or serialization semantics
change is introduced.

Candidate addon SHA-256:
`96ba87bcc9a76f9c2cce21cede7ef74ea10e69b147a69b5435536f1ce81c5f86`.
The original archived release binary remains
`154d1683ec0db600a2053528c08d776ac123367fb9afee573cb173466c14e0a1`.
Source snapshot: `benches/reproduction/run-575ffccd1aff.cjs`, SHA-256
`575ffccd1aff69efbbba1cb337b150494a8b03c378f9ef5d0d6d76b6edeaa50f`.
Seven independent benchmark harness tests passed before candidate timing. The
lead's compilation/unit/integration/type checks and independent output review
were completed before the exclusive timing window; final package checks are
tracked separately in the roadmap.

The original binary is loaded through the official generated loader's
`NAPI_RS_NATIVE_LIBRARY_PATH` override, before the public wrapper loads native.
Every archived child asserts the exact original SHA. Timed calls still pass
through the complete current public wrapper, napi input conversion, engine,
output representation conversion and returned JS value. Archived binary metadata
explicitly identifies original source ref
`113a8eb79dbf7350d1f15a7e639d7a5e2492abee` and embeds that ref's Git source
blobs separately from the current working-tree sources. Current local target
release metadata is not falsely attributed to the overridden artifact.

### Matched Node24 controls

The eight-control archive and candidate groups run consecutively with identical
methods, data, consumption, 300 ms warmup and nine 100 ms samples per cell, in
two shuffled run orders. New placement controls challenge dense Unicode prefixes
with long ASCII tails, the reversed ordering, and an ASCII prefix followed by
dense Unicode. All **64 control cells** pass exact oracle checks.

| Existing JSON text | Original run 1 / 2 ops/s | Candidate 2 run 1 / 2 ops/s | Change run 1 / 2 |
|---|---:|---:|---:|
| Real CLDR Bengali | 6870 / 6840 | 9082 / 8946 | +32.2% / +30.8% |
| Latin-1 (`é` x16000) | 7525 / 7163 | 24607 / 24608 | +227.0% / +243.5% |
| Sparse Unicode (50k ASCII + emoji) | 11752 / 12059 | 11538 / 11967 | -1.8% / -0.8% |
| ASCII string, 50k | 37180 / 37254 | 36742 / 37894 | -1.2% / +1.7% |
| Short Unicode | 1.906M / 1.847M | 1.931M / 1.920M | +1.3% / +3.9% |
| Emoji prefix, 50k ASCII tail | 9660 / 9610 | 9381 / 9350 | -2.9% / -2.7% |
| 50k ASCII prefix, emoji tail | 11231 / 10638 | 11185 / 10975 | -0.4% / +3.2% |
| 2k ASCII prefix, dense Bengali/emoji | 10382 / 10563 | 10574 / 10829 | +1.8% / +2.5% |

The real-data positive gate is exceeded in both runs; the sparse regression is
resolved. No control has a >10% regression. CLDR candidate MADs are 0.62%/1.14%,
sparse 1.29%/0.63%. Some baseline JS controls are noisy (CLDR JS run2 MAD6.15%);
they remain in the raw files. These are local sample summaries, not confidence
intervals or universal runtime claims.

Normalized core uses one-second warmup: Unicode 8258/8506 versus original
one-second 4541/4479, gains of approximately 82%/90%. It remains below JS
parse+upstream 13260/13377. Lock 3342/3384 versus earlier 3268/3318 is stable;
API 235.0/230.0 is close to prior 235.5/232.3 (earlier API warmup was300 ms).
The original 3377/1338 historical lock result remains a representative local
measurement, not a constant rate. All nine text-gap shapes and twelve object
roundtrip shapes pass exact output checks and have no >10% negative paired
median regression. Ordinary native roundtrip remains workload dependent.

### Size-one batch anomaly and confirmation

The first size-one loop cell in the broader candidate suite measured 977k ops/s,
about 20% below its older baseline, while run2 recovered to 1.240M. This unfavorable
cell is retained. A controlled original/candidate repeat at one-second warmup
measured original loop1.178M/1.195M versus candidate1.211M/1.158M (+2.8%/-3.1%).
Batch-call rates also stayed within a few percent. The larger deficit did not
reproduce; process/tiering/host variation remains an unresolved explanation,
not a demonstrated source bottleneck. No hidden data exclusion or batching
speedup claim is made. Batch APIs still lose to repeated native calls on these
real record workloads and remain convenience APIs.

### Node22 minimum-runtime controls

The exact same archived/candidate binaries and public wrappers were measured on
Node **v22.13.0**, V8 **12.4.254.21-node.22**, through the project-local verified
runtime. Two runs of the five original controls, 300 ms warmup and nine 100 ms
samples, produce **40 passing exact-output cells**:

| Existing JSON text | Original run 1 / 2 ops/s | Candidate 2 run 1 / 2 ops/s | Change run 1 / 2 |
|---|---:|---:|---:|
| Real CLDR Bengali | 6532 / 6666 | 8799 / 8947 | +34.7% / +34.2% |
| Latin-1 | 9899 / 10005 | 29169 / 27381 | +194.7% / +173.7% |
| Sparse Unicode | 12828 / 12533 | 12675 / 12764 | -1.2% / +1.8% |
| ASCII string, 50k | 54311 / 59926 | 52571 / 59941 | -3.2% / +0.0% |
| Short Unicode | 1.904M / 1.810M | 1.822M / 1.907M | -4.3% / +5.4% |

Node22 also exceeds the real-data >=10% improvement gate with no >10% control
regression. Its absolute rates differ materially from Node24, illustrating why
performance claims need runtime identity. Node22 CLDR native MAD stays below
1.3%; its candidate JS run1 is noisy (MAD7.52%) and is retained. Full Node22
matrix/selection/mixed-prefix performance was not executed; this is the recorded
five-control minimum-runtime check, not a complete cross-runtime proof.

### Reproduction commands and artifacts

```powershell
node --test benches/reproduction/reproduction.test.cjs
node benches/reproduction/coverage.cjs archive-encoding-controls revised-encoding-controls candidate-text text-gaps candidate-roundtrip batch-elements
node benches/reproduction/coverage.cjs archive-batch-one-confirm revised-batch-one-confirm
& ./.tools/node-v22.13.0-win-x64/node.exe benches/reproduction/coverage.cjs archive-basic-controls encoding-controls
```

| Evidence | Completed manifest / summary prefix | Measured cells |
|---|---|---:|
| Node24 full candidate experiment | `2026-10-19T01-02-36-170Z-coverage` |160 |
| Matched size-one confirmation | `2026-10-19T01-06-47-689Z-coverage` |8 |
| Node22 original/candidate controls | `2026-10-19T01-07-17-568Z-coverage` |40 |

All paths are under `benches/reproduction/results/`; completed `.json` manifests
link raw per-group reports and `-summary.md` files retain every rate and MAD.
Total **208 measured cells**, comprising 152 candidate and 56 archived-original
cells, passed exact output checks. Actual per-child artifact hashes and runtime
metadata were checked from the saved results. Every scheduled group completed;
no timed processes remain. The lead is released to run final package checks.

Acceptance is limited to this measured optimization. The Latin-1/synthetic
Unicode native APIs can remain slower than JavaScript, caching still depends
on correct explicit versions, allocation counts remain unmeasured, all functions
remain synchronous, and unavailable-platform release gates remain UNVERIFIED.
