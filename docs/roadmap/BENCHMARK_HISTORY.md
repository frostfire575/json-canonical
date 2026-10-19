# Benchmark history

No measurements existed at bootstrap. All following raw results are preserved
without overwriting under benches/results. Full tables: benches/REPORT.md;
original architecture report: benches/BASELINE_REPORT.md.

| Milestone | Commit | Command/config | Raw artifact | Finding |
|---|---|---|---|---|
| Initial upstream baseline | pre-MVP | node benches/run.cjs,7x35ms |2026-10-18T23-55-47-261Z-23840.json|tiny1.73Mops/s,lock1938ops/s; no native claim|
| Baseline full |9c4a1fe|same,102 cells|2026-10-19T00-00-39-680Z-30968.json|real text gains, deep/Unicode native regressions|
| Baseline confirm |9c4a1fe|9x100ms,6 workloads|2026-10-19T00-01-33-156Z-10332.json|native deep/Unicode65–67%below parse+upstream|
| Scanner full |28326e7|7x35ms,102 cells|2026-10-19T00-06-17-364Z-30392.json|all exact output checks pass|
| Scanner confirm1 |28326e7|9x100ms,6 workloads|2026-10-19T00-07-07-143Z-9768.json|deep regression fixed, real gains retained|
| Scanner confirm2 |28326e7|same|2026-10-19T00-07-51-677Z-8716.json|lock3377vs1338;API231vs137;Unicode4432vs13134ops/s|
| Same-native batch |28326e7|9x100ms,batch32|2026-10-19T00-08-59-583Z-26116.json|native batch3.2%slower than repeated native calls|
| Selection confirm1 |991e97c|9x100ms,6workloads4methods|2026-10-19T00-14-09-631Z-7976.json|lock/wide gains,API/Unicode/deep/tiny losses|
| Selection confirm2 |991e97c|same|2026-10-19T00-14-43-812Z-19944.json|lock6789vs4556,API513vs681ops/s|

All figures include public API conversion/return costs. Text/sorting comparisons
use pre-existing normalized JSON; JS baseline is JSON.parse+upstream. Selection
raw text and parsed scalar outcomes are measured separately. JSON.stringify-only
is contextual. Each raw JSON stores actual configuration,environment,commit,hashes,
every sample,MAD,CPU,RSS and blocking probes. Earlier contaminated runs are retained
and explicitly excluded in NOTES.md/INDEPENDENT_REVIEW.md. Allocation counts are
NOT MEASURED. Rust stage profile is separate Rust-only evidence, not npm throughput.
