# Independent installed native JSON-text review, second continuation

Status: **PASS**. Main108 cells plus54 separately paired direct-field selection
controls completed; all162 complete exact pre/post comparisons, packed/runtime
identities, full-corpus/frozen-runner integrity checks and minimum samples pass.
No production serializer optimization or new API was introduced.

## Scope and semantic checks

This independent runner is `benches/native-text-verification/run.cjs`; it imports
no prior benchmark runner. It requires an actual schema2 npm-installed candidate,
checks the archive digest, every manifest-bound packed and installed byte identity,
the actual Node addon loaded, and equality with the Windows compiled release DLL.
The starting candidate is `.verification/readiness-final-01`, tar SHA256
`b424ebbc68d01fe6031ed40d8d17ecc9e1f459cce5bd84f5296cba042956957a`;
native SHA256 `96ba87bcc9a76f9c2cce21cede7ef74ea10e69b147a69b5435536f1ce81c5f86`.
Newer documentation and package metadata do not alter these measured runtime bytes.

Five pinned original real-world/open-source source files include TypeScript
configuration and dependency metadata (Apache2), JSONPlaceholder service data
(MIT; fictional public API backing data), Bengali CLDR localization (Unicode3)
and the established upstream benchmark fixture (MIT; mock API records). The last
fixture is explicitly not a captured production response. All source URLs,
commits, retrieval dates, sizes, SHA256 and licenses persist in the source
manifests and raw results. Three normalized lock/API/CLDR controls and one small
real API-user record supplement these original-text workloads.

Sorting is public `stringifyJson(existingText)` against
`upstream(JSON.parse(existingText))`. Selection is public
`selectJson(existingText,pointer)` against `JSON.stringify` of the equivalent
field after `JSON.parse`. Original and normalized inputs must pass complete
exact string comparison before and after timing. Selected scalar paths are
`/name`, `/users/0/email`, `/0/email`, `/main/bn/localeDisplayNames/languages/en`
and `/email` as applicable. These paths do not establish deep-subtree performance.

Sorting preserves JSON scalar token spelling; selection returns raw text. Untimed
controls preserve differences for `1.00`, `-0`, escaped strings, numbers beyond
exact JS integer precision, raw subtree whitespace, duplicate/lone-surrogate
keys and invalid JSON. Such differences are never timed as equivalent work.
There is no RFC8785, general JSON.parse replacement or object-stringify claim.

## Method and evidence

Three deterministically shuffled passes; every method/workload cell has its own
fresh process. One-second warmup and nine samples of at least100ms per cell.
All wrapper checks, Node-API conversions, native work and returned strings are
inside the public call. JS baseline parsing/lookup/serialization is inside its
call. Setup, fixture reading/generation, module loading, archives, expected
outputs and hashes are outside timing. String length and middle UTF16 code unit
are consumed. Full expected input/output text is retained in a compressed corpus;
raw reports preserve actual exact pre/post checks and output hashes.

Per-cell samples, median, MAD, latency, input/output throughput, CPU microseconds,
RSS snapshots and process maxRSS persist. Memory includes setup, fixtures,
archive validation, modules and warmup: it is not serializer-only peak memory or
allocation counts. Neither lower memory nor nonblocking/event-loop benefits can
be inferred. Within-process MAD does not replace between-process variation.
This performance scope is Windows x64 Node24 only; Node22 harness correctness
checks are separate and no Linux/macOS runtime was executed.

```powershell
$env:NATIVE_TEXT_CANDIDATE='.verification/readiness-final-01'
node --test benches/native-text-verification/run.test.cjs
node benches/native-text-verification/run.cjs
```

Seven harness selftest groups pass on **both Node22.13.0 and24.20.0**, including
all45 installed method/input combinations without timing, corrupted installed
bytes/archive rejection, unsupported semantic controls, statistics, missing
candidate/minimum timing settings and incomplete/duplicate summary evidence.
The final Node22 rerun completed after timing; no Node22 performance claim.

Environment: Windows11Pro10.0.26300 x64, i7-12700K20logical CPUs,34087682048bytes
RAM; Node24.20.0/V8 13.6.233.17-node.53; Rust/Cargo1.98.1; pnpm12.10.1;
Git2.55.0.windows.5. Source HEAD at measurement is
`f7b1f73a0057e582f73068b5500dbb9ad82eafa3` with documentation/review work in
progress. Raw git status is preserved. Current runtime/native byte equality to
the measured packed artifact is separately verified; no modified README or
package description is misrepresented as the old artifact's metadata.

## Original-text sorting results

Each table entry is run1 / run2 / run3 median ops/s. These are pre-existing
**original downloaded text** comparisons, including source whitespace. All
five source files produce exactly the same full sorted text as the stated
baseline. They do not establish equivalence for arbitrary lexical JSON.

| Source | Input bytes | Public `stringifyJson` | `JSON.parse` + upstream | Native/JS ratios |
|---|---:|---:|---:|---:|
| TypeScript dependency lock |143844|2392 /2397 /2339|1017 /774 /1090|2.35 /3.10 /2.15|
| TypeScript config |1838|175804 /172713 /177697|66546 /69824 /74401|2.64 /2.47 /2.39|
| JSONPlaceholder service data |1378184|178 /172 /178|115 /106 /112|1.54 /1.62 /1.60|
| Upstream mock API fixture |3965|83997 /84469 /84312|33452 /33233 /35475|2.51 /2.54 /2.38|
| Bengali CLDR languages |25897|6698 /6422 /5975|3988 /3937 /3972|1.68 /1.63 /1.50|

Advantages repeat across these five exact-checked original inputs. Variability
is material: lockJS run2 is774 vs1017/1090 in the other runs; CLDRnative falls
from6698 to5975. Raw samples retain unfavorable observations; no run was dropped.
The measured ratio range1.50–3.10 across this matrix is workload and machine
specific, not a universal advertised multiplier.

Normalized/small controls are separately labeled and never replace source inputs:

| Transformed existing text | Bytes | Native sort | Parse + upstream | Native/JS ratios |
|---|---:|---:|---:|---:|
| Normalized dependency lock |93728|3022 /2854 /2936|1083 /1124 /1148|2.79 /2.54 /2.56|
| Normalized full API |1085130|192 /164 /194|114 /109 /109|1.68 /1.51 /1.78|
| Normalized CLDR |19086|7672 /7030 /7606|3905 /4011 /3700|1.96 /1.75 /2.06|
| Derived real API-user record |401|501819 /426317 /501590|193850 /164488 /183588|2.59 /2.59 /2.73|

Original/normalized rows represent different input byte lengths and whitespace;
their throughput must not be collapsed into one number. On the original fullAPI
text native median latency is5.61–5.80ms/op and input throughput226.6–234.2MiB/s.
OriginalCLDR is149–167microseconds/op and147.6–165.4MiB/s. Full per-run latency,
input/output throughput, sample MAD and CPU work persist in the summary/raw data.
The largest within-process MAD across all108 cells is16.54%, in lock-original
JSsorting pass2 (the774ops/s cell); it is not a between-process confidence
interval or evidence every cell varies that much.

## Memory observations

Process maxRSS ranges below include fixture parsing, all manifest/installed/archive
identity work, modules and warmup. Each entry is the range across three fresh
processes for that method. These are executed whole-worker high-water readings,
**not serializer-only peak allocations**. Different GC schedules and setup
temporaries can affect them. No generalized lower-memory claim is justified.

| Original source | Sort-native peakRSS MiB | Sort-JS peakRSS MiB |
|---|---:|---:|
| Dependency lock |71.3–71.5|127.2–127.3|
| Config |70.7–71.4|71.3–71.6|
| Full API |134.0–136.3|252.5–258.7|
| Upstream fixture |70.8–70.9|78.4–78.5|
| CLDR |71.8–72.1|94.9–95.2|

CPU usage across each cell's measured samples and RSS/heap/external snapshots
are in raw data.
No V8 allocation counters, production concurrency, event-loop delay or isolated
Rust-only allocation evidence is inferred from this experiment.

## Extraction requires its own positioning

The original108-cell baseline uses a generic runtime JSON Pointer interpreter,
including segment splitting/decoding during each call. That is a valid general
selection comparison, but is more work than a caller's fixed literal field
accesses. An independent review challenged this distinction. A **separate54-cell
paired control** therefore repeats native public selection against
`JSON.stringify(selectLiteral(JSON.parse(input)))`, with explicit literal selectors
chosen before timing: `value.name`, `value.users[0].email`, `value[0].email`,
`value.main.bn.localeDisplayNames.languages.en` and `value.email` as applicable.
No generic path decode/dispatch is hidden in this direct JS baseline.

Three fresh-process run medians ops/s:

| Input / path | Public `selectJson` | Parse + direct field + stringify | Native/JS ratios |
|---|---:|---:|---:|
| Original lock `/name` |3741 /3717 /3698|3436 /3278 /3499|1.09 /1.13 /1.06|
| Original config `/name` |173362 /188537 /188948|283608 /269863 /296800|0.61 /0.70 /0.64|
| Original API `/users/0/email` |323 /324 /349|512 /549 /529|0.63 /0.59 /0.66|
| Original upstream `/0/email` |80984 /88218 /89348|135204 /130387 /143747|0.60 /0.68 /0.62|
| Original CLDR language `en` |4993 /5022 /5532|11809 /11634 /12740|0.42 /0.43 /0.43|
| Normalized lock `/name` |5581 /5602 /5912|3671 /3599 /3804|1.52 /1.56 /1.55|
| Normalized API `/users/0/email` |410 /414 /436|596 /558 /588|0.69 /0.74 /0.74|
| Normalized CLDR language `en` |6728 /7032 /7274|12604 /12941 /13104|0.53 /0.54 /0.56|
| Small API-user `/email` |363839 /420012 /433752|809875 /805507 /705790|0.45 /0.52 /0.61|

Only normalized-lock extraction has a repeated >=10% benefit in this direct
control. Original lock gains6–13% and fails that threshold in two runs. Every
other case is slower with native extraction. Original API native selection is
2.87–3.09ms/op. Its whole-worker peakRSS is69.4–71.5MiB vsJS127.2–160.9MiB;
these process observations have the same setup/GC caveats and are no isolated
allocation proof. Largest within-process MAD in the54-cell control is7.70%.

Position `stringifyJson` as the primary performance-oriented operation for
existing JSON text requiring deterministic key sorting. Position `selectJson`
as a bounded raw-extraction tool with explicitly workload-specific performance;
there is no basis to call extraction generally faster. Preserve compatible
`stringify` as convenience/compatibility, with its separately measured lack of
a repeatable >=10% gain. No automatic native routing, extra batching work,
speculative parallelism or parser feature is justified by these measurements.

## Reproduction and immutable evidence

Main command above uses9variants ×4methods ×3passes =108cells. Paired control:

```powershell
$env:NATIVE_TEXT_CANDIDATE='.verification/readiness-final-01'
$env:NATIVE_TEXT_METHODS='select-native,select-direct-js'
node benches/native-text-verification/run.cjs
Remove-Item Env:NATIVE_TEXT_METHODS
```

Completed 2026-10-19UTC; serialized runs had the lead's CPU-clear window and no
concurrent builds/tests/other benchmark processes. Scheduling, GC, clocking and
thermals remain uncontrolled; do not infer causes for observed between-run spread.

Evidence under `benches/native-text-verification/`:

- Main raw: `results/2026-10-19T09-56-55-718Z-33544.json`, SHA256
  `ee10472c78ca83c0b0ca4bdf53b1e9ffa12872786df64b5092acaaee4df67ef1`.
- Direct-control raw: `results/2026-10-19T10-01-50-243Z-33224.json`, SHA256
  `de20b822f050ca5b9824cdc3e55d2de306e5d23f916be60cdb130c7e8d7fdc26`.
- Each raw has matching `-summary.json` and `-corpus.json.gz`; the corpus retains
  full exact expected text, not only parsed values or output length. Both corpora
  intentionally contain the same9inputs/expected outputs and have SHA256
  `71671c576900fa25a740caeb84a0ed7c1aab1f685131a9405971b640b3042736`.
- Main frozen runner `run-3a8b7300eb85.cjs`; direct-control snapshot
  `run-c63c3040e3a8.cjs`. Full hashes are in each raw report. Neither is overwritten.
- `results/runtime-identity-2026-10-19T10-06.json` binds current Rust/JS/lock source
  hashes and actual releaseDLL to packed/installed/loaded native/runtime identities.
- `verify-evidence.cjs` independently checks completed unique cells, actual
  corpus and frozen-runner hashes, every input/full-output hash, minimum9samples
  and100ms durations, warmup and native artifact identities: **108PASS /54PASS**.
- `summarize.cjs` refuses incomplete/duplicate/mismatched-output evidence and
  writes new summary files exclusively. Raw reports include every actual sample,
  median/MAD, latency/throughput/CPU/memory observation and machine/configuration.

Exact integrity commands (PASS):

```powershell
node benches/native-text-verification/verify-evidence.cjs benches/native-text-verification/results/2026-10-19T09-56-55-718Z-33544.json
node benches/native-text-verification/verify-evidence.cjs benches/native-text-verification/results/2026-10-19T10-01-50-243Z-33224.json
```

The real packed candidate is Windows-only. Linux/macOS performance, combined
package execution and production readiness remain **UNVERIFIED**.
