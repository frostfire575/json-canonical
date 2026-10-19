# Performance by API and workload

The public JavaScript-compatible `stringify` and `stableStringify` APIs have no
Rust conversion or automatic native dispatch. Current measurements do **not**
establish a repeatable general speed advantage over pinned
fast-json-stable-stringify. Rust JSON-text results describe a separate operation.

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

## Current installed object-API results

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

## Current JSON-text and selection results

These separately timed operations use pre-existing normalized text. All24
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

## Methodology, evidence and limits

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
