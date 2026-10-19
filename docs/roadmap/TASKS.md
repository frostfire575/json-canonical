# Tasks

## Independent continuation audit

| ID | Priority | Status | Dependencies | Acceptance criteria |
|---|---|---|---|---|
| R1-REPRO | P0 | DONE | none | Independently inspect old raw evidence, rebuild release, reproduce real lock/API + Unicode/batch with independent runner twice; record exact outputs, boundary costs, samples and hashes |
| R1-FULL | P1 | DONE | R1-REPRO | Extend independent coverage to other prior text/object/selection claims; record output-consumption sensitivity separately |
| R2-PROFILE | P0 | DONE | R1-REPRO | Measure encoding/boundary/engine/sort/output and batch stages; no inferred bottleneck presented as measured; retain justified optimizations only after separate tests and before/after runs |
| R3-COMPAT | P1 | DONE | none | Independent expansion for IEEE numbers, surrogate pairs, getters/toJSON/comparator effects, large/wide/repeated/cyclic values; exact strings/errors/events and current integration suite pass |
| R4-PACKAGE | P1 | BLOCKED | none | CI installs identical final bundled tarball across three target runners with runtime/types/native checks; local lint/Windows artifact pass; unavailable actual jobs explicitly UNVERIFIED |
| R4-CONFIG | P1 | DONE | none | Pack once, checksum-bound candidate workflow; identical tarball Windows Node22/24 npm/pnpm runtime/types install pass, lint/negative missing-platform test pass; remote jobs not counted |
| R5-UTILITY | P1 | DONE | R1-REPRO,R2-PROFILE | Benchmark real-data batch sizes and cache hit/miss/version/update patterns; simplify or retain with evidence; no new advanced features |

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

## Production-readiness continuation

| ID | Priority | Status | Dependencies | Acceptance criteria |
|---|---|---|---|---|
| RD-BATCH | P0 | DONE | none | Reproduce malformed-Unicode batch validation bypass; indexed single-read snapshot; independent regressions, release build/all tests and batch before/after measurements |
| RD-CI | P0 | DONE | none | Review current official runner labels; bind packed/installed/loaded runtime files and binary architectures; negative verifier tests and actionlint; actual absent targets UNVERIFIED |
| RD-PACK | P0 | DONE | RD-BATCH,RD-CI | Pack a new candidate once; offline npm/pnpm CJS/ESM/strict declarations/native checks on available runtimes; same digest; combined missing binaries explicitly fail and target execution remains blocked |
| RD-PUBLIC | P1 | DONE | RD-PACK | Measure actual installed CJS/ESM stringify/alias vs pinned upstream on equivalent real objects, conversion included for separate roundtrip; 2fresh runs/multiple samples/raw identities and no unsupported speed claim |
| RD-REVIEW | P0 | DONE | RD-BATCH | Independent security/correctness/package review, dependency/advisory/license evidence; resolve findings or record release blockers |
| RD-DOCS | P1 | DONE | RD-PUBLIC,RD-PACK,RD-REVIEW | Separate per-API performance report, current roadmap/handoff/test/regression evidence, reviewed verified local commits |

## Native JSON-text positioning and distribution evaluation

| ID | Priority | Status | Dependencies | Acceptance criteria |
|---|---|---|---|---|
| NT-REPRO | P0 | DONE | none | Independent installed native sort/extract measurements on >=5real licensed fixtures, >=2fresh runs/9samples, exact pre/post outputs, complete public boundary, latency/throughput/process memory and append-only raw identities |
| NT-SEC | P0 | DONE | none | Independent native text/security/API review with adversarial tests on Node22/24; preserve/fix every found bug and rerun fullchecks |
| NT-DIST | P1 | DONE | none | Verify combined and optional-package release layouts against official napi/npm docs and actual local prototype; real host binaries only; inspect/lint3platform CI; foreign runtime remains UNVERIFIED |
| NT-DOCS | P1 | DONE | NT-REPRO | Native text APIs positioned as workload-specific performance surface; compatible stringify retained without acceleration claim; runnable CJS/ESM/TS examples and precise token/extraction limitations |
| NT-VERIFY | P0 | IN_PROGRESS | NT-SEC,NT-DIST,NT-DOCS | Release build/Rust/JS/differential/TS checks, available runtime packaged installs/examples, lint/audit, updated evidence/handoff and verified local commits |
