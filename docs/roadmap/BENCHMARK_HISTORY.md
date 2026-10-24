# Benchmark history

All runs on Windows 11 x64, i7-12700K, Node 24.22.1, via `node benches/run.cjs`.
Raw files are in `benches/results/` and are never edited. Benchmarks of 0.1 are on
`master` under its own history.

| Raw file | Settings | Code state | Status |
|---|---|---|---|
| 2026-10-24T04-25-35-618Z.json | 100 ms warmup, 3 x 30 ms | first v2 build | Smoke run only, too short to quote |
| 2026-10-24T04-28-38-804Z.json | 300 ms, 5 x 100 ms, floats only | after number fix (closest digits) | Floats canonicalize 0.81x of JS |
| 2026-10-24T04-33-18-153Z.json | 500 ms, 9 x 100 ms, foreground | number fast path; Node-API string input; external Buffer output | Full baseline before boundary work |
| 2026-10-24T04-35-27-505Z.json | 500 ms, 9 x 100 ms, subset | encodeInto for 1 KiB+, small Buffer outputs copied | Subset after first boundary changes |
| 2026-10-24T04-37-09-861Z.json | 500 ms, 9 x 100 ms, subset | U+FFFD scan replaces isWellFormed on large strings | 8 MB validate 1.16x, select 1.11x |
| 2026-10-24T04-41-06-112Z.json | 500 ms, 9 x 100 ms, background, unpinned | before review fixes | INVALID: baselines 2.5x slower than identical earlier run, likely E-core scheduling |
| 2026-10-24T04-44-04-703Z.json | 500 ms, 9 x 100 ms, pinned to P-cores, high priority | before review fixes | First pinned run; "after" column of the boundary table |
| 2026-10-24T04-57-37-315Z.json | 500 ms, 9 x 100 ms, pinned | review fixes: deferred sort patches, round-trip check on every 16-17 digit number | Floats canonicalize regressed to 0.28x; superseded |
| 2026-10-24T05-00-56-883Z.json | 500 ms, 9 x 100 ms, pinned | round-trip check limited to powers of two (final code) | Reference run 1 of 3 |
| 2026-10-24T05-03-37-786Z.json | same | final code | Reference run 2 of 3 |
| 2026-10-24T05-06-06-944Z.json | same | final code | Reference run 3 of 3; medians of runs 1-3 are in docs/performance.md and README |
