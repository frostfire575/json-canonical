# Decisions

## ADR 001 — Separate compatibility from text processing (2026-10-19)
Accepted. Preserve upstream traversal in a typed JS fallback, including quirks;
offer Rust text APIs separately. Rejected automatic serde conversion of live JS
objects: it changes numbers, UTF-16, getters, comparator and toJSON behavior.
Direct Node-API traversal is an experiment for later profiling, not the default.

## ADR 002 — Native token-preserving text output
Accepted for MVP. Use serde_json RawValue for validation/traversal; preserve raw
primitive tokens, decode keys for UTF-16 sorting, and reject duplicate decoded
keys and lone surrogate keys. Text API is explicitly distinct from JS stringify.
Bound bytes and nesting; never relax compatibility implicitly for speed.

## ADR 003 — Version-required cache
Accepted. Require an explicit version argument each time. Cache stores one result
per weakly-held object, supports delete/clear, and recomputes for a changed version.
Caller must change version on any observable mutation; document that responsibility.

## ADR 004 — Local Git workflow
User authorizes local commits, branches and merges. Use a local implementation
branch after the initial memory commit; merge stable verified milestones locally.
No push, publish or release is authorized.

## ADR 005 — Candidate packages bundle native artifacts
Accepted for local/CI validation: official napi-generated loader resolves local
native files; CI combines three target artifacts into one root tarball. This
allows ordinary npm installation without Rust or unpublished optional packages.
Download size is the tradeoff. Scoped sidecar packages may be adopted before
public release, using official napi create-npm-dirs tooling and separate approval.
Fixture bytes are excluded from Git line-ending conversion for checksum stability.

## ADR 006 — Single validation, borrowed token tree
Accepted after two longer end-to-end confirmation runs. Repeated RawValue
subtree deserialization was65–67% slower than parse+upstream on deep/Unicode
workloads. Replace that strategy with one complete serde validation, then safe
structural scanning, borrowed unescaped keys/scalars and one output emission.
This adds scanner maintenance and node-vector memory; independent lexical corpus,
malformed cases, depth bounds and generated oracle tests must stay passing. The
scanner is never a standalone validator. No unsafe code introduced. Stage timings
in `cargo bench --bench engine` distinguish validation, scan/sort and emission;
these Rust-only results are not end-to-end npm API performance claims.

## ADR 007 — Raw selective extraction
Experimental until performance gate confirmed. RawValue visitors walk path-level
containers without constructing a JS DOM or full Rust token tree. A separate
allocation-free scan enforces whole-document depth after serde syntax validation.
Use JSON Pointer subset (no fragments/expressions), last duplicate wins, raw text
output and undefined for missing. Traversed object keys must decode as Unicode
scalar strings, while untouched raw subtrees need not. These differences are
explicit; no full RFC6901 compliance claim. Tests independently cover3500 paths.

## ADR 008 — CI host selection
Use macos-15 ARM64 rather than near-deprecated macos-14; current hosted runner
labels checked against [GitHub's runner reference](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)
on2026-10-19. CI definitions remain unexecuted evidence until jobs run.
