# stable-json-rs engineering guide

Read this file before editing. Resume by reading docs/roadmap/SESSION_HANDOFF.md,
PROGRESS.md, TASKS.md, docs/architecture.md and docs/decisions.md; inspect Git status
and recent commits and verify incomplete work before continuing.

## Objective and boundaries
Build a measured Rust-powered npm library for JSON text: RFC 8785 canonicalization,
token-preserving key sorting, minification, validation and JSON Pointer selection.
Never assume Rust is faster. No publishing, remote pushes, releases, unrelated
deletions or modifications outside this repository without human approval.
Local dependencies, builds, tests, benchmarks and local commits are authorized.

## Architecture and conventions
Use Rust stable, napi-rs v3, TypeScript wrappers, pnpm and Node's test runner.
`crates/core` is the engine: no dependencies, `unsafe` forbidden, clippy pedantic
clean. `crates/node` is the binding; `js/index.ts` owns argument validation and
error conversion. Canonical output must match V8 (`String(Number)`, UTF-16 key
order); test against V8 as the oracle. Ask before adding dependencies. Avoid
speculative parallelism. The upstream checkout is a pinned read-only benchmark
baseline, never edit it. Preserve MIT attribution for adapted code.

## Workflow and evidence
Tasks live in docs/roadmap/TASKS.md with ID, priority, dependencies, acceptance
criteria and TODO/IN_PROGRESS/BLOCKED/DONE/DEFERRED/REJECTED status. DONE requires
executed acceptance checks. Update PROGRESS.md and SESSION_HANDOFF.md after each
milestone. Store commands, environment, failures and artifacts in TEST_RESULTS.md,
REGRESSIONS.md and BENCHMARK_HISTORY.md. Never overwrite benchmark evidence.
Run Rust tests, release addon build, JS differential tests, type checks and actual
binding integration checks for relevant changes. Use thousands of seeded cases,
adversarial tests and independent review. Benchmark public API end to end with
warmup, multiple samples, equivalent output, raw machine-readable results and
real-world fixtures. Report slower results and unavailable platforms honestly.

## Harness and responsibility split
The harness has terminal/file tools, web research and independent subagents.
Delegate research, benchmark work or adversarial review with disjoint file
ownership; do not have two agents edit the same files. The lead owns integration.
Use installed skills only where applicable; do not install agent frameworks.
No new local skills are required until a repeatable workflow warrants one.

## Release gate
Installation from a packed artifact, CJS/ESM/TS, native loading, compatibility,
security/dependency review and CI on Windows x64, Linux x64 and macOS ARM64 must
be verified before claiming production readiness. Unavailable platforms are
UNVERIFIED. Approval to publish must be explicit.
