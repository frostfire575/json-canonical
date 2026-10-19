# Encoding and batch investigation (in progress)

2026-10-19, Windows x64,Node24.20.0,Rust1.98.1; independent production baseline
identity in REPRODUCTION_REVIEW.md. Probes live in benches/profiling and are never
packaged. Each verifies output, warms up300ms, measures9x100ms and preserves raw
JSON. Probe class overhead is different from production free functions; stages
cannot be naively added or subtracted. These are causal stage-isolation experiments,
not V8/Rust internal call-stack profiles. Node/V8 allocation counts are not measured.

## Measured original encoding cost
First profile: benches/profiling/results/2026-10-19T00-31-35-530Z-11100.json.
Second profile: 2026-10-19T00-33-45-177Z-23092.json.

| Unicode-heavy input stage | First median microseconds | Second median microseconds |
|---|---:|---:|
| Napi class call, no payload transfer |0.229|0.232|
| Input UTF8 allocation/copy/encoding |46.582|46.276|
| Input UTF16 allocation/copy |1.283|1.261|
| Stored UTF8 output creation (borrowed, no Rust string clone) |133.602|131.649|
| Stored UTF16 output creation (includes vector clone) |3.428|3.491|
| Rust engine with stored input, returns only length |36.087|35.488|
| Serde whole-document validation |10.754|10.638|
| Structural scan/sort/drop |23.652|23.392|
| Public stringifyJson, all normal boundary costs |222.302|226.729|
| Parse + pinned JS upstream |76.274|76.232|

This isolates UTF8 input/output handling as the dominant measured stage category
on this dataset, especially output creation. It does not isolate V8 allocator vs
encoding instructions inside that category. Generic FFI call overhead alone is
small here. Sorting/scanning still matter within the36us engine; the data do not
justify changing UTF16 ordering or replacing correct sorting speculatively.

UTF16 standard-library output route measured108–112us including input conversion,
Rust engine, fresh UTF16 transcoding and returned JS string. Both input/output
UTF16 route measured91–99us, but regressed the ASCII dependency lock to403–416us
vs293–299us production. Do not force either encoding for all inputs.

## Rejected and refined experiments
- encoding_rs0.8.42 bulk transcoding prototype measured111us on Unicode vs91us
  for std UTF16 input/output, and320us on lock vs293us production. No production
  dependency added. Private optional experimentation is not a package speed claim.
- Forcing UTF16 output on a sparse string (50000 ASCII chars +one emoji) measured
  98us vs85us production. Rejected unconditional output conversion.
- An initial density predicate excluded Latin1: this missed a large benefit,
  because repeatedé measured38us with UTF16 output vs135us production. Refined
  prototype considers all non-ASCII UTF8 bytes.
- Candidate routing criterion: outputs at least1024 bytes and at least1/8 non-ASCII
  bytes; otherwise retain UTF8. Prototype measured124us vs226us Unicode,47us vs134us
  Latin1,82us vs84us sparse Unicode,28us vs27us ASCII string. This is an empirical
  heuristic, not an optimal universal threshold. Public-API and wider-data before/
  after checks are still required before adoption. Small inputs bypass routing.

Initial private probe raw JSON stores source hashes and artifact identity; early
experimental source revisions were not individually committed. Current methods
retain standard/bulk alternatives, and subsequent reports additionally embed the
exact probe source/lock snapshots. Original production sources are unchanged and
identified by113a8eb/6da938b throughout baseline measurements.

## Next checks
Independently complete historical matrix, batch/cache usefulness and consumption
sensitivity. Then verify allocation/copy categories and batch conversion/return
costs, test a minimal adaptive output production change, run all compatibility
checks and two matched public-API confirmations. No automatic JSON.parse fallback:
it would change native token/duplicate/Unicode semantics. The compatible live-object
API already provides the deliberate JavaScript route.

## Batch and allocation observations
`node benches/profiling/batch.cjs` (00-48-54-632Z-7208-batch.json) checks each result
and consumes returned array elements directly. Real32-record wrapper validation
3.070us, Vec<String> input extraction5.591us, pre-stored output clone/conversion
5.564us, stored engine14.891us, no-payload call0.243us. Full public batch30.160us
vs repeated public calls28.315us. These categories include allocation/copy plus
encoding and array access, not individual V8 instructions. They explain why saving
one function invocation per item does not remove per-item array marshalling.
Private collect25.410us vs preallocated25.965us (MAD1.7/0.9%): no justified gain.

Safe stats_alloc instrumentation (00-49-29-827Z-10412-allocations.json) excludes
Node/V8 and input loading. Preallocating32 outputs saves3 reallocations in tiny,
Unicode, lock and CLDR cases. Actual core allocations remain: single tiny2,
Unicode2,lock755,CLDR8; reallocations are reported separately in raw output.
No own unsafe Rust was introduced; instrumented timings are not used.
The key-only internal timer restores original textual order and excludes tree
construction, but includes iteration/timer granularity; full raw observations are
in00-49-30-013Z-24432.json. UTF16 sorting behavior remains unchanged.

## Final accepted output route
Full-count classifier rejected. Bounded four256-byte samples isolate the small
routing cost (~0.3–0.5us class probes), versus14.7us fullcount on sparse output.
Raw predicate reports00-55-33-341Z-25732 and00-56-25-381Z-2764 retain exact code.
Independent release public-API and minimum-runtime results in
OUTPUT_BENCHMARK_REVIEW.md satisfy the declared repeated gate; this is separate
from private stage timings. Allocation/copy costs remain and syntheticUnicode
still loses to JS. No SIMD, new production dependency, sorting change or unsafe
code was needed. Batch/preallocation complexity was rejected on measured evidence.
