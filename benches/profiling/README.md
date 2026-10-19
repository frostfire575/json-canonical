# Boundary and engine stage probes

Development-only crate, not shipped in the npm package. It includes the same
engine/tree source and exact locked napi/serde versions, with the same release
LTO/codegen settings. No unsafe Rust is introduced. Build before timing:

```powershell
pnpm exec napi build --cwd benches/profiling --release --platform --output-dir native --js binding.js --dts binding.d.ts
node benches/profiling/run.cjs
```

`PROFILE_DATASETS` filters unicode,dependency-lock,tiny or other datasets exported
by benches/datasets.cjs. `PROFILE_SAMPLE_MS` changes sample duration. Every method
checks its expected result, warms up300ms and measures9 samples. Keep all other
builds/tests/benchmarks stopped. Raw JSON records metadata, hashes and samples.

Probes separate input extraction (UTF8 vs UTF16, including napi allocation/copy),
output creation (borrowed UTF8 vs cloned precomputed UTF16), roundtrips, engine
with pre-stored input, validation, scan/sort/drop and experimental encoding routes.
Production `stringifyJson` is measured alongside the same parse+upstream baseline.
Code-point conversion, allocator copying, V8 encoding, and library implementation
details are not individually separable inside each probe. Stage durations cannot
be naively summed/subtracted or advertised as public-API speedups. In particular,
the precomputed UTF16 output probe includes a vector clone while borrowed UTF8
does not; actual candidate routes encode UTF16 afresh on every call.

The Rust clock emission observation excludes tree construction and Node-API
timing; the enclosing method still builds/drops a tree outside that clock. Counts
of native allocations and V8 internal stack samples are NOT MEASURED. These probes
provide causal stage isolation, not a full V8/Rust call-stack profiler. Candidate
optimizations require release public-API tests and independent before/after runs.

Allocation counts: build with `cargo build --release --manifest-path
benches/profiling/Cargo.toml --features alloc-profile --bin allocations`, then
`node benches/profiling/allocations.cjs`. Input creation is outside count regions.
Run `node benches/profiling/batch.cjs` for batch conversion/engine/output probes.
These are diagnostic artifacts only, excluded from the npm package. No Node/V8
allocation counts or internal call stacks are claimed. Early reports predate the
separate Rust allocation-count binary and retain their original limitations.
