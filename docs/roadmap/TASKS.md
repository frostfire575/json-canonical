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

## Detailed follow-up acceptance
| ID | Priority | Status | Dependencies | Acceptance criteria |
|---|---|---|---|---|
| P4-SCAN | P0 | IN_PROGRESS | P1 | Capture old native samples; test single-validated borrowed spans; all regression tests + two before/after runs; reject regressions without tradeoff |
| P6-PARSE | P2 | TODO | P4 | Compare public object creation to JSON.parse or document reason to defer; no unmeasured speed promise |
| P6-SELECT | P1 | TODO | P4 | Evaluate selective existing-text extraction without JS DOM, limited path syntax, whole-input validation, limits and benchmark vs parse+selection |
| P6-STREAM | P2 | TODO | P4 | Evaluate incremental processing/backpressure/cancellation; defer unless genuine implementation justified |
| P6-ASYNC | P2 | TODO | P4 | Evaluate main-thread conversion/event-loop boundaries; no automatic nonblocking claim |
| P6-HASH | P2 | TODO | P4 | Define exact byte rules and compare materialization/digest costs; no unverified canonical standard claim |
| P7-PACK | P0 | DONE | P3 | Install tarball offline with scripts disabled; CJS/ESM/native calls pass |
| P7-AUDIT | P1 | TODO | P2 | pnpm audit and available Cargo advisory/license checks recorded; failures addressed or blocked |
| P7-CI | P1 | IN_PROGRESS | P3 | Nonpublishing 3-target CI config, bundled artifact design; local checks pass; remote run explicitly pending |
