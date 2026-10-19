# Performance methodology and current evidence

Run `pnpm bench` after `pnpm build`. See `benches/README.md` for fixture provenance,
filters and raw fields. Benchmarks use the complete compiled release addon public
API, isolated child processes per dataset/method, warmup, seven measured samples,
median and median absolute deviation. Output is consumed and exact-string checked
before timing. Fixture creation/I/O occur outside timed loops. Cold require is
separate from steady state; native loading is measured separately from lazy wrapper
loading. Raw results are append-only under benches/results.

`native-text` starts with existing JSON text; compare to `upstream-from-text`
(JSON.parse plus oracle), not object-only oracle when claiming a benefit.
`native-roundtrip` includes JSON.stringify conversion and can differ for arbitrary
JS values; only equivalent fixture outputs are admitted. JSON.stringify results
are contextual and not an equivalent stable serialization comparison.

Machine: Windows11 x64, Intel i7-12700K 12 cores/20 logical, Node24.20.0 /
V8 13.6.233.17-node.53, Rust1.98.1, pnpm12.10.1. The machine is not a dedicated
benchmark host. Short runs guide architecture, not universal claims. CPU usage,
RSS observations/resource maxRSS and blocking timer delay are measured where
supported; retained/peak heap allocations and precise native allocation counts
are NOT MEASURED. Timer delay reflects a synchronous timed loop, not async support.

Initial uncontaminated upstream baseline: tiny1,730,117 ops/s (MAD0.4%), real
TypeScript dependency lock1,937.8 ops/s (MAD0.9%), config129,098.6 ops/s,
Unicode18,627.8 ops/s, record array1,394.8 ops/s. Command:
`node benches/run.cjs`; raw `2026-10-18T23-55-47-261Z-23840.json`.
A subsequent competitor-only run overlapped compilation and is exploratory,
not acceptance evidence. Full isolated native comparisons are pending.

Performance gate: correctness first; intended workload median >=10% improvement
across repeated independent runs with no unexplained >10% regression before an
optimization becomes the preferred route. Faster JS remains the compatibility
default; an explicit native text API may still be useful on selected workloads.
Never infer Rust speed from compilation, microbenchmarks or external reports.
