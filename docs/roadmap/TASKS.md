# Tasks

| ID | Priority | Status | Dependencies | Acceptance criteria |
|---|---|---|---|---|
| P0 | P0 | DONE | none | Environment, pinned upstream audit, research, architecture and persistent memory recorded |
| P1 | P0 | IN_PROGRESS | P0 | Reproducible real/synthetic fixtures and upstream/competitor raw baseline results |
| P2 | P0 | DONE | P0 | Release napi v3 addon, pure Rust tests and public CJS/ESM/TS smoke pass |
| P3 | P0 | DONE | P2 | Upstream suite and thousands of seeded differential/adversarial tests pass; independent review |
| P4 | P1 | IN_PROGRESS | P1,P3 | Measure native boundary and alternatives; retain only justified optimizations |
| P5 | P1 | IN_PROGRESS | P3 | Batch and explicit cache semantics tested and benchmarked |
| P6 | P2 | TODO | P4 | Evaluate parsing, selection, streaming, async and hashing independently; record implement/defer decisions |
| P7 | P1 | TODO | P3,P4,P5 | CI, packed install, audit, examples and accurate documentation; platform release gates explicit |
