# Performance by API and workload

The native JSON-text sorter is the primary measured performance surface. Raw
extraction has narrower workload-dependent benefits. Both start with existing
text; neither automatically accelerates live-object serialization. Compatible
stringify remains a JavaScript convenience with no established general advantage.

## What each comparison measures

| API / pipeline | Starting input and timed work | Equivalent baseline |
|---|---|---|
| `stringify` / `stableStringify`, CJS or ESM | Same live object, public export access and full compatibility traversal | Pinned upstream on the same object |
| Explicit object-to-native roundtrip | `JSON.stringify(value)` on every call, then public `stringifyJson`, native conversion and returned string | Upstream object serialization, only for exact-checked JSON-only fixtures |
| `stringifyJson` | Already available JSON text, wrapper limits, full napi input/engine/output costs | `JSON.parse(text)` plus upstream |
| `selectJson` | Already available text to selected raw JSON text | `JSON.parse`, equivalent field access and `JSON.stringify` selected value |
| `stringifyJsonBatch` | Existing ordered texts, snapshot validation, native array/string conversion and returned elements | Repeated public calls to the same native sorter |
| `stringifyBatch` | Ordered compatibility calls through `Array.from` | Equivalent ordinary serialization loop |
| Versioned cache | Lookup/version/mutation schedule plus serialization on misses | Same schedule with ordinary public serialization |

The native text API preserves scalar token spelling and has distinct duplicate,
Unicode and limit rules. Its operation is not generally interchangeable with
JavaScript-object serialization or RFC8785 canonicalization. Native calls are
synchronous and block the event loop.

## Independently repeated original JSON-text sorting

Primary performance-oriented API: `stringifyJson(existingText)`. A second
independent runner measures original source text instead of silently normalizing
it, with three shuffled fresh-process passes and nine >=100ms samples after1s
warmup. Installed release package/native boundary costs are included. Source
retrieval/setup, archive checks, module loads and expected output creation are
outside timing; parsing in the JS baseline is inside timing. Every complete
returned string exactly matches before/after timing for these fixtures.

Windows11 x64/i7-12700K,Node24.20.0,Rust1.98.1. Actual measured candidate SHA256
b424ebbc68d01fe6031ed40d8d17ecc9e1f459cce5bd84f5296cba042956957a;
native96ba87bcc9a76f9c2cce21cede7ef74ea10e69b147a69b5435536f1ce81c5f86.
New description/examples/docs do not change the measured runtime. Native sorting
wins on all five original files across all three passes. The mock upstream
fixture is not a captured production response. Full raw rows, normalized-text
sensitivity controls and small real API record remain separate in the
[text review](roadmap/NATIVE_TEXT_REVIEW_2.md).

| Original source input | Bytes | Native ops/s, run1/2/3 | Parse + upstream ops/s, run1/2/3 | Native microseconds/op range | Native input MiB/s range |
|---|---:|---:|---:|---:|---:|
| Dependency metadata |143844|2392/2397/2339|1017/774/1090|417.2–427.5|320.9–328.8|
| Application config |1838|175804/172713/177697|66546/69824/74401|5.6–5.8|302.7–311.5|
| API backing data |1378184|178/172/178|115/106/112|5612.3–5800.4|226.6–234.2|
| Upstream mock API |3965|83997/84469/84312|33452/33233/35475|11.8–11.9|317.6–319.4|
| Bengali CLDR |25897|6698/6422/5975|3988/3937/3972|149.3–167.4|147.6–165.4|

These inverse-throughput latency summaries include output consumption and timer
overhead; they are not individual-call p95/p99. Within-cell MAD and between-pass
variation are preserved. JS dependency-metadata pass2 has16.54% MAD, versus
2.48/1.95% in its other passes; do not choose the favorable ratio as a blanket
claim. No runtime optimization was introduced in this continuation.

| Whole-process peak RSS, original sorting | Native MiB range | JS MiB range |
|---|---:|---:|
| Dependency metadata |71.3–71.5|127.2–127.3|
| Application config |70.7–71.4|71.3–71.6|
| API backing data |134.0–136.3|252.5–258.7|
| Upstream mock API |70.8–70.9|78.4–78.5|
| Bengali CLDR |71.8–72.1|94.9–95.2|

RSS/maxRSS include fixture parsing, oracle outputs, modules, archive validation,
warmup and garbage collection. These observed process high-water values are not
isolated serializer peaks, allocation counts or a general memory guarantee. The
raw report also retains before/after heap/RSS snapshots and CPU per sample group.
Native byte bounds do not bound process RSS. No Node22/foreign-OS performance or
event-loop responsiveness gain is established by this matrix.

## Extraction: direct field access as a separate control

The108-cell experiment includes generic runtime pointer decoding in the JS
baseline. A second54-cell experiment pairs the same public native calls against
literal selectors (for example JSON.parse(input).users[0].email), with fixed
selector construction outside timing. It still includes JSON.parse and
JSON.stringify of the selected scalar. All54complete exact checks pass.
This avoids attributing a generic JavaScript path interpreter's overhead to a
native extraction advantage. Both experiments use three fresh shuffled passes.

| Existing text / same scalar path | Native extraction ops/s, run1/2/3 | Parse + direct field + stringify ops/s, run1/2/3 |
|---|---:|---:|
| Original dependency metadata |3741/3717/3698|3436/3278/3499|
| Original application config |173362/188537/188948|283608/269863/296800|
| Original API backing data |323/324/349|512/549/529|
| Original upstream mock fixture |80984/88218/89348|135204/130387/143747|
| Original Bengali CLDR |4993/5022/5532|11809/11634/12740|
| Normalized dependency metadata |5581/5602/5912|3671/3599/3804|
| Normalized API backing data |410/414/436|596/558/588|
| Normalized Bengali CLDR |6728/7032/7274|12604/12941/13104|
| Small real API user |363839/420012/433752|809875/805507/705790|

Only normalized dependency metadata repeats a >=10% extraction gain (about52-56%
throughput). Original dependency metadata varies about6-13% with two passes below
10%; it does not meet that repeated acceptance gate. Native extraction loses on
every other direct-field control. Keep it as a bounded raw-text API and recommend
it for performance only after measuring the actual document form and path.
No full-subtree/deep-path performance or blanket JSON.parse replacement is implied.

Combined162cells preserve samples, exact compressed input/output corpus, frozen
runner sources and packed/installed/loaded identities under
benches/native-text-verification/results/. Mainraw2026-10-19T09-56-55-718Z-33544.json;
directraw2026-10-19T10-01-50-243Z-33224.json. Each has a separate summary/corpus.
See [reproduction instructions](../benches/native-text-verification/README.md)
and [independent evidence](roadmap/NATIVE_TEXT_REVIEW_2.md). Full native calls are
synchronous; saving object materialization is not event-loop offloading.

## Prior normalized-text and generic selection evidence

This prior source757bc26 matrix uses pre-existing normalized text (candidate
66e82b265c2e3dfb3edfe7220c1b2c63a0506e453612d7c8884f95f7e7667017). All24
comparison cells pass exact text checks; input creation and parsing for fixture
setup are outside timing, while parsing in each JS baseline is inside timing.
Selection uses `/name`, `/users/0/email` and
`/main/bn/localeDisplayNames/languages/en` respectively. Rates are run1 / run2 ops/s.

| Existing text | `stringifyJson` | Parse + upstream | `selectJson` | Parse + lookup + stringify |
|---|---:|---:|---:|---:|
| Real dependency metadata |3558 /3451|1427 /1393|7024 /6999|4980 /4956|
| Real full API document |250 /205|146 /143|535 /527|713 /712|
| Real Bengali CLDR data |9569 /9311|5165 /5110|8762 /8680|17497 /17110|

Text sorting wins on these inputs, while selection loses on the API and CLDR
inputs. API text throughput varies substantially between processes; raw samples
retain that variation. A large text-only win and a slower object roundtrip can
both occur on the same dataset. Neither supports a universal stringify claim.

## Separate installed live-object API evidence

Windows11 x64, i7-12700K, Node24.20.0/V8 13.6.233.17-node.53, Rust1.98.1.
Candidate source `757bc263d0ce9c6774da5fd68e3f7b9935e152ef`, packed SHA256
`66e82b265c2e3dfb3edfe7220c1b2c63a0506e453612d7c8884f95f7e7667017`.
It includes both native-wrapper validation fixes. CJS and ESM resolve the actual
installed package root exports; both aliases are the same function today.
Compatibility paths assert that **zero native addons load**. There is no hidden
object conversion/fallback preprocessing to exclude from timing.

Seven real inputs, six methods, two shuffled fresh-process runs: 84 measured
cells, all exact-output checks pass. Each cell warms up for one second, then
measures nine samples of at least100ms. Rates below are run1 / run2 median ops/s,
not confidence intervals. Full CJS/ESM/alias tables and per-cell MAD are in the
[public API review](roadmap/PUBLIC_API_PERFORMANCE_REVIEW.md).

| Live-object workload | Public CJS `stringify` | Upstream |
|---|---:|---:|
| Real application config |121624 /134961|119283 /134572|
| Real dependency metadata |1879 /2162|2067 /2020|
| Real full API document |157 /176|154 /176|
| Real Bengali CLDR data |7958 /8000|7620 /7894|
| Real32-comment array |34572 /36292|33972 /36259|
| Real API user record |334233 /347746|332600 /340552|

No compatibility method achieved a repeatable >=10% gain on any fixture across
both runs. A positive result in one process can disappear or reverse in another;
even identical-function alias rates vary. Do not advertise these functions as
Rust-accelerated or generally faster than upstream. Arbitrary callbacks/getters
are covered by correctness tests, not by this JSON-only performance matrix.

The complete object-to-native pipeline measured2361 /2396ops/s on dependency
metadata versus upstream2067 /2020, but CLDR measured6186 /6213 versus7620 /7894
(about19-21% slower). It is equivalent only for these verified fixtures. This
selected pipeline benefit cannot justify automatic native routing for live JS
values with getters, toJSON, unsupported values or custom comparators.

## Batch and cache usefulness

Current real32-comment native batches measured34913 /34898batches/s versus the
previous wrapper34629 /35020: no meaningful throughput change from the security
fixes. Current same-native repeated calls measured36397 /37643, so batching is
about4-7% slower. Validation, native marshalling and element consumption are all
included; returned arrays are not serialized again just to consume them.

Retain native batching for ordered results, aggregate input limits and indexed
native-document errors. Retain JS batching for the corresponding compatibility
convenience. Neither API promises boundary amortization or faster serialization.
The snapshot fix gives the native batch predictable single indexed reads instead
of using caller-controlled iterators or rereading values after validation.

Historical real32/128-record version-cache pools included identical selection,
version and mutation work: misses were3-5% slower,50% hits about1.8x throughput,
90% hits about7.3-7.7x. The cache implementation is unchanged in this continuation;
these are prior measurements, not fresh current-run claims. Retain it for known
unchanged versions and manual invalidation. Hits skip work; they do not detect
mutation. Undefined results are cached, exceptions are not, and live keys can
retain large output strings. See [the independent review](roadmap/REPRODUCTION_REVIEW.md).

## Reproduction and measurement limits

For the primary text experiments use an explicit NATIVE_TEXT_CANDIDATE and
node benches/native-text-verification/run.cjs (or pnpm bench:text); the runner
README gives exact main/direct method filters. Original and normalized text stay
labeled. Independent verify-evidence.cjs binds corpus bytes, frozen runner source,
all162exact pre/post outputs and loaded release identities. Build/test/audit CPU
work was stopped during timing. The shared workstation, GC, clock checks and
thermal/scheduling state remain uncontrolled. No universal guarantee follows.

The following commands/evidence refer to the earlier separate public object
experiment, retained as historical measurements:

Run serially with other builds/tests stopped. Use
`PUBLIC_API_CANDIDATE=.verification/readiness-benchmark-01` with
`node benches/public-api/run.cjs`; see [runner instructions](../benches/public-api/README.md)
for platform-specific syntax and filters. Raw reports and immutable source snapshots
are in `benches/public-api/results/` and `benches/public-api/run-*.cjs` in the
checkout. Object, batch and text/selection reports start at
`2026-10-19T01-32-18-492Z`, `01-35-24-055Z` and `01-36-28-139Z` respectively.
The npm artifact includes documentation summaries; full fixtures/runners/raw
measurements belong to the development checkout.

Fixture reading, construction, expected outputs and module loading occur outside
timing. Every output's length and middle UTF16 code unit are consumed, including
rope materialization. Exact outputs are checked before and after timing. Native
methods use the compiled release addon; packed, installed and loaded byte hashes
are recorded. Source/license provenance, Node/V8/toolchain/CPU/OS/commit, every
sample, median, MAD, latency, output throughput and CPU/memory observations persist.
Process RSS/maxRSS include setup and are not serializer-only peaks or allocation
counts. Scheduling, GC and thermal state are uncontrolled; within-process MAD is
not a between-process confidence interval. No new public-API performance claim
is made for Node22 or unavailable operating systems; those local correctness
checks and CI targets are separate evidence.

The earlier3377 versus1338ops/s claim was reproduced as a range for existing
normalized dependency-lock JSON, not as a public object API speedup. Historical
404-cell reproduction,208-cell Unicode output investigation, failed experiments,
consumption sensitivity and cold loading remain in
[reproduction](roadmap/REPRODUCTION_REVIEW.md),
[output review](roadmap/OUTPUT_BENCHMARK_REVIEW.md) and
[historical report](../benches/REPORT.md). Private Rust-only allocation/stage probes
are in [profiling review](roadmap/PROFILING_REVIEW.md); they exclude Node/V8 and
are not additive end-to-end timings.

Correctness comes first. A preferred optimization must show >=10% intended-workload
improvement across repeated runs without an unexplained repeated >10% regression.
Security fixes can be retained for correctness with their measured cost disclosed.
Current wrapper fixes preserve token, Unicode, error and compatibility rules.
