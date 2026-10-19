# Reproducible local benchmarks

For current installed CJS/ESM object APIs, use [the public API runner](public-api/README.md)
and [per-API evidence](../docs/roadmap/PUBLIC_API_PERFORMANCE_REVIEW.md). The older
harness below preserves historical comparisons and supports exploratory work.

Run `node benches/run.cjs` after installing project dependencies and building the
release addon. Every cell validates its exact output against the pinned upstream
before timing. A differing output is INCOMPATIBLE and is never reported as a
speedup. A missing module or API is UNAVAILABLE. JSON.stringify is contextual
throughput only: it does not provide the same key-order guarantee.

Each dataset/method runs in a fresh Node child process, with two sample durations
of warmup and seven measured repetitions by default. The timer is checked every
16 operations; elapsed time is measured, so expensive operations may exceed the
target. Results include every sample, median operations/second, median latency,
median absolute deviation (MAD), output throughput, process CPU time, sampled
RSS/heap, process maximum RSS and timer-probe delays. An output checksum keeps
results observable. Fixtures, logging, module loading and validation are outside
the measured loop. Garbage collection remains enabled and is part of each run.
The `medianLatencyUs` field is the reciprocal of median sample throughput (an
amortized per-operation duration), not a distribution of individual call latency.
The checksum reads output length and a middle UTF-16 code unit. That common
consumption step may force V8 concatenated strings to flatten; timings therefore
cover producing and touching the output, rather than only constructing a rope.

Cold require is measured separately in five fresh processes, excluding process
startup. Disk caches can be warm. No claim about cold disk or deployment startup
is made. Maximum RSS is the process lifetime maximum, including fixture loading,
runtime, require and warmup; it is not serializer-only memory or allocation data.
Timer probes measure blocking for one synchronous benchmark burst plus scheduler
delay; they do not measure per-operation tail latency. No allocations profiler is
installed: allocations are NOT MEASURED. CPU time covers the measured repetitions
and between-repetition scheduling; it is not an isolated instruction count.

The `native-text` method receives JSON that already exists. Compare it with
`upstream-from-text`, which includes JSON.parse plus upstream serialization.
For ordinary JS object inputs use `native-roundtrip`, which includes
JSON.stringify on every call before native text processing. Public `stringify`
and both stable JavaScript competitors receive objects directly. Batch methods
include conversion of the returned result list to a string on both sides so the
comparison and result consumption are equivalent. Cache-hit uses unchanged
identity/version; cache-miss changes the explicit version for every call.
`batch-text-native` compares a single native batch call with
`batch-text-upstream-loop` parsing each pre-existing text and applying upstream.
Both return a list of strings, and both include the same result-list consumption.
`batch-text-native-loop` calls the same native text engine once per document;
this is the comparison that isolates whether batching itself adds a benefit.

PowerShell examples:

```powershell
node benches/run.cjs
$env:BENCH_DATASETS = 'tiny,dependency-lock,unicode'
$env:BENCH_REPS = '9'
$env:BENCH_SAMPLE_MS = '100'
node benches/run.cjs
Remove-Item Env:BENCH_DATASETS,Env:BENCH_REPS,Env:BENCH_SAMPLE_MS
```

`BENCH_METHODS` accepts a comma-separated subset. Minimum repetitions is five.
For selection, use `select-js-text,select-native-text` to compare returning raw
JSON text (JS includes JSON.stringify of the selected value), and
`select-js-scalar,select-native-scalar` to compare returning a JS scalar (native
includes JSON.parse of the selected raw text). These are distinct operations.
Paths are predefined for tiny, dependency-lock, public-api-data, Unicode, deep
and wide data; each raw cell records the exact pointer. Both consume identical
output types. JS uses path segments decoded before timing, while the public
native API includes pointer parsing on each call. Full-input validation remains
part of native timing. Output byte throughput for scalars is a logical rendered
payload size, not FFI traffic; input MiB/s is also recorded for text selection.
Raw results are written with exclusive creation to timestamped `results/*.json`
and include command, machine, Node/V8/Rust, Git dirty state, upstream commit and
content hashes. Run serially on an otherwise idle machine for release decisions.
The benchmark does not control power mode, thermal state or scheduler placement.
Short defaults are exploratory; confirm proposed optimizations with longer runs
and avoid drawing conclusions from differences inside observed variability.

`data/manifest.json` records real open-source dependency metadata/configuration,
JSONPlaceholder's public API backing dataset and the established upstream
API-shaped fixture, with source SHA, retrieval time,
license, raw size and hash. Required notices are retained beside the datasets.
JSONPlaceholder contains intentionally fake service data and supplies several
large arrays and nested user/address records from the actual open-source service;
it is not production user information. The upstream fixture is mock data, not
an actual service capture. Tiny, deep,
wide, Unicode, large-string, record-array, backend-payload and batch inputs are
deterministically generated supplements in `datasets.cjs`; the backend payload
is synthetic and must not be described as real production traffic. No private
or sensitive datasets are used. An attempted Ajv package-lock fetch returned 404;
TypeScript's checked-in lockfile was used instead.

Acceptance gates: exact compatibility first; no >5% public compatibility-API
regression versus upstream without an explained feature tradeoff; native text
should beat parse+upstream by at least 10% on a relevant real-world workload,
beyond measured variability, before being recommended for performance. Caching
and batching are evaluated against equivalent repeated calls with correctness
tests as a prerequisite. These gates guide decisions; failing gates are reported,
not hidden. One-machine data does not verify other operating systems.
