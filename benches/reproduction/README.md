# Independent performance reproduction

This harness does not import the original benchmark runner/datasets. All timed
native operations use `js/index.cjs` and its actual release addon; checksums and
memory/CPU/environment metadata are retained in append-only `results/*.json`.
See `docs/roadmap/REPRODUCTION_REVIEW.md` for the initial audit and actual results.
`run-v1.cjs` preserves the exact initial measured runner; use maintained `run.cjs`
for new experiments.

Do not run concurrently with builds, tests, profiles or another benchmark. The
default is two separately shuffled child-process runs, nine 100ms samples and
300ms warmup. Raw reports store all effective configuration. On PowerShell,
remove old variables with `Remove-Item Env:REPRO_*` between distinct experiments.
An individual config can also be run in a fresh shell. All fixture construction,
file reads, oracle checks and native initialization precede the timed loop.

```powershell
node --test benches/reproduction/reproduction.test.cjs
node benches/reproduction/run.cjs --check
node benches/reproduction/run.cjs
node benches/reproduction/coverage.cjs
```

`coverage.cjs` serially executes text gaps, the full ordinary-object matrix,
selection, array-element batches, mutation/version cache pools and length-only
consumption sensitivity. It snapshots the exact measured runner source and
records each raw report in a coverage manifest. Optional arguments select group
names: `text-gaps`, `object-matrix`, `selection`, `batch-elements`, `cache-pools`,
`length-sensitivity`. Allow approximately seven minutes for the full two-run
coverage on the recorded machine. `node benches/reproduction/summarize.cjs
<coverage-manifest>` generates an append-only table artifact without rerunning
timings. The in-progress coverage manifest is a progress checkpoint; immutable
raw reports and completed manifests are never overwritten.

The separately requested `encoding-controls` group verifies and times real
CLDR Bengali localization data (`benches/profiling/data/cldr-manifest.json`,
Unicode-3.0) plus `latin1-large`, `sparse-unicode`, `ascii-string-50k` and
`short-unicode` isolation shapes. Run `node benches/reproduction/coverage.cjs
encoding-controls` before and after a native output change. These extra cases
are excluded from default coverage to keep the original six-group comparison
stable. `node benches/reproduction/cold-start.cjs` independently measures five
fresh-process requires per module in two serial rounds; Node startup is excluded
and OS disk caches may be warm.

`REPRO_DATASETS` and `REPRO_METHODS` select comma-separated cells. Defaults retain
the initial 34-cell matrix. Additional methods are enabled when an explicit
dataset selection is supplied. `REPRO_RUNS` >=2, odd `REPRO_SAMPLES` >=9,
`REPRO_SAMPLE_MS` >=100 and `REPRO_WARMUP_MS` >=200 are required. `REPRO_SEED`
controls reproducible method order; `REPRO_CONSUMPTION` is `flatten` (default,
string length + middle character) or `length` (no flattening character access).

Available shapes include `tiny`, `deep`, `wide`, `unicode`, `application-config`,
`upstream-api-fixture`, `large-string`, `record-array`, `backend-payload`,
`array-of-32`, `lock-normalized`, `lock-source`, `api-normalized`, `api-source`.
The source variants retain their actual formatted bytes. Normalized variants
are prepared through JSON.parse/JSON.stringify outside the timed section.

| Method | Timed operation |
|---|---|
| oracle/native/safe-stable/fast-stable | Existing JSON text to stable string; JS includes parse, native includes the complete wrapper and napi conversions |
| object-oracle/object-public/object-native-roundtrip | Prepared JS value to stable string; roundtrip includes JSON.stringify and native processing |
| object-safe-stable/object-fast-stable | Prepared JS value through named competitor |
| JSON-context | JSON.stringify of prepared JS value; exact candidate-specific result checked, **not stable-equivalent** |
| select-native-text/select-oracle-text | Extract raw scalar JSON; native public selectJson vs JSON.stringify(selected JSON.parse result) |
| select-native-scalar/select-oracle-scalar | Return JS scalar; native public extraction + JSON.parse vs parsed document lookup |

Selection paths exist for tiny, deep, wide, lock-normalized, api-normalized and
unicode, matching the historical cases. JS path segments are prepared outside
timing; native includes public pointer parsing. Whole-input validation is native
work. Missing-path or selected-object throughput is not claimed by these cases.

`batch-tiny-32` and `batch-api-records-32` support native-batch/native-loop/
oracle-loop (text input) plus public-batch/public-loop (prepared JS object input).
These all include identical JSON.stringify of the returned string array.
`batch-api-elements-1/8/32/128` instead support native-batch-elements,
native-loop-elements and oracle-loop-elements. They consume each returned string
directly, isolating array-return overhead from JSON.stringify of the entire list.
Compare methods within the same input contract and consumption mode.

`cache-api-document` retains the initial single-identity methods oracle,
public-stringify, cache-hit and cache-miss. The mixed scenarios are
`cache-pool-32-hit0/50/90/99` and `cache-pool-128-hit0/50/90/99`, with methods
cache-pool/public-pool/oracle-pool. A pool uses real API comments, prefilled cache,
round-robin access and a deterministic 100-operation hit/miss schedule. Every
scheduled miss mutates the body and increments an explicit version; *all*
candidates include that scheduling, mutation and version maintenance. A fresh
independent 400-operation oracle replay verifies every result before timing.
The percentage is the planned serialized-cache hit fraction, not automatic
mutation detection. Memory reports include all setup and cannot be interpreted
as cache-only retention or serializer-only allocation counts.

Example one-second-warmup sensitivity:

```powershell
$env:REPRO_DATASETS='lock-normalized,unicode'
$env:REPRO_METHODS='oracle,native'
$env:REPRO_WARMUP_MS='1000'
$env:REPRO_CONSUMPTION='length'
node benches/reproduction/run.cjs
```
