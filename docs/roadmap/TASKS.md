# Tasks

## Independent continuation audit

| ID | Priority | Status | Dependencies | Acceptance criteria |
|---|---|---|---|---|
| R1-REPRO | P0 | DONE | none | Independently inspect old raw evidence, rebuild release, reproduce real lock/API + Unicode/batch with independent runner twice; record exact outputs, boundary costs, samples and hashes |
| R1-FULL | P1 | IN_PROGRESS | R1-REPRO | Extend independent coverage to other prior text/object/selection claims; record output-consumption sensitivity separately |
| R2-PROFILE | P0 | IN_PROGRESS | R1-REPRO | Measure encoding/boundary/engine/sort/output and batch stages; no inferred bottleneck presented as measured; retain justified optimizations only after separate tests and before/after runs |
| R3-COMPAT | P1 | DONE | none | Independent expansion for IEEE numbers, surrogate pairs, getters/toJSON/comparator effects, large/wide/repeated/cyclic values; exact strings/errors/events and current integration suite pass |
| R4-PACKAGE | P1 | BLOCKED | none | CI installs identical final bundled tarball across three target runners with runtime/types/native checks; local lint/Windows artifact pass; unavailable actual jobs explicitly UNVERIFIED |
| R4-CONFIG | P1 | DONE | none | Pack once, checksum-bound candidate workflow; identical tarball Windows Node22/24 npm/pnpm runtime/types install pass, lint/negative missing-platform test pass; remote jobs not counted |
| R5-UTILITY | P1 | TODO | R1-REPRO,R2-PROFILE | Benchmark real-data batch sizes and cache hit/miss/version/update patterns; simplify or retain with evidence; no new advanced features |

| ID | Priority | Status | Dependencies | Acceptance criteria |
|---|---|---|---|---|
| P0 | P0 | DONE | none | Environment, pinned upstream audit, research, architecture and persistent memory recorded |
| P1 | P0 | DONE | P0 | Reproducible real/synthetic fixtures and upstream/competitor raw baseline results |
| P2 | P0 | DONE | P0 | Release napi v3 addon, pure Rust tests and public CJS/ESM/TS smoke pass |
| P3 | P0 | DONE | P2 | Upstream suite and thousands of seeded differential/adversarial tests pass; independent review |
| P4 | P1 | DONE | P1,P3 | Measure native boundary and alternatives; retain only justified optimizations |
| P5 | P1 | DONE | P3 | Batch and explicit cache semantics tested and benchmarked |
| P6 | P2 | DONE | P4 | Evaluate parsing, selection, streaming, async and hashing independently; record implement/defer decisions |
| P7 | P1 | BLOCKED | P3,P4,P5 | CI, packed install, audit, examples and accurate documentation; platform release gates explicit; target runtime jobs required |

## Detailed follow-up acceptance

| ID | Priority | Status | Dependencies | Acceptance criteria |
|---|---|---|---|---|
| P4-SCAN | P0 | DONE | P1 | Capture old native samples; test single-validated borrowed spans; all regression tests + two before/after runs; reject regressions without tradeoff |
| P6-PARSE | P2 | DEFERRED | P4 | Compare public object creation to JSON.parse or document reason to defer; no unmeasured speed promise |
| P6-SELECT | P1 | DONE | P4 | Evaluate selective existing-text extraction without JS DOM, limited path syntax, whole-input validation, limits and benchmark vs parse+selection |
| P6-STREAM | P2 | DEFERRED | P4 | Evaluate incremental processing/backpressure/cancellation; defer unless genuine implementation justified |
| P6-ASYNC | P2 | DEFERRED | P4 | Evaluate main-thread conversion/event-loop boundaries; no automatic nonblocking claim |
| P6-HASH | P2 | DEFERRED | P4 | Define exact byte rules and compare materialization/digest costs; no unverified canonical standard claim |
| P7-PACK | P0 | DONE | P3 | Install tarball offline with scripts disabled; CJS/ESM/native calls pass |
| P7-AUDIT | P1 | DONE | P2 | pnpm audit and available Cargo advisory/license checks recorded; failures addressed or blocked |
| P7-CI | P1 | DONE | P3 | Nonpublishing 3-target CI config, bundled artifact design; local actionlint checks pass; remote run explicitly pending |
| P7-TARGETS | P0 | BLOCKED | P7-CI | Execute Linux x64/macOS ARM64 CI and install combined artifact on every target; Docker daemon/macOS unavailable locally |
| P7-FRESH | P1 | DONE | P7-PACK | Fresh isolated Git checkout installs locked deps, rebuilds native, passes tests/checksums/types/packed install |
