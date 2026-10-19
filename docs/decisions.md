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
Accepted as an explicit niche API after two benchmark confirmations on real
dependency metadata (+49% throughput). API fixture and deep/Unicode inputs lose,
so no general replacement recommendation. RawValue visitors walk path-level
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

## ADR 009 — Batch and cache usefulness after independent reproduction
Retain ordered batches for convenience, bounded aggregate input and indexed
document errors, with no acceleration claim. Real record sizes1/8/32/128 showed
native batch3–33% below the same native calls in a loop, including direct returned
element consumption. Isolated probes show array input/output conversion and wrapper
validation costs; saved generic call overhead is small. Preallocation saves3 Rust
reallocations at32 items but did not improve real throughput, so reject that change.
An additional adaptive JavaScript/native batch dispatcher would add error and
observable-access complexity without an established acceptance result. Keep the
small shared-engine implementation; no speculative batch optimization or workers.

Keep the explicit versioned WeakMap cache. Two real32/128-record pools with the
same mutation/version schedule show miss overhead3–5%,~1.8x throughput at50% hits
and~7.3–7.7x at90%. These conditional gains justify the feature. No deep hashing,
automatic mutation detection or immutable-object assumption is introduced.

## ADR 010 — Bounded lossless output encoding
Accepted for the verified Windows Node22.13/24.20 scope after independent exact
tests and repeated public-API comparisons. Napi UTF8 output creation dominated
the measured dense-Unicode workload; use the existing napi Utf16String path for
dense output. Four distributed256-byte samples must each contain at least32
non-ASCII bytes. This empirical classifier bounds routing work at1024 bytes and
returns identical content regardless of classification. Input and pure engine
semantics, token spelling, limits and error behavior stay unchanged.

Reject unconditional UTF16 (ASCII regressions), the extra encoding_rs production
dependency (slower probes), and full-output density counting (16% sparse regression).
Prefix-only screening still penalized Unicode prefixes with long ASCII tails.
Bounded sampling passed mixed-prefix controls, real CLDR (~31–32% improvement on
Node24,34–35% on22) and the broader matrix. Dense synthetic Unicode improved but
still loses to JS parse+upstream. Keep the explicit JS compatibility route; automatic
JSON.parse fallback would change native duplicate/token/Unicode semantics.
Raw evidence, an anomalous short-warmup batch cell and targeted confirmation are
retained in OUTPUT_BENCHMARK_REVIEW.md. This is not a universal speed guarantee or
cross-platform performance verification. Selection output is unchanged.

## ADR 011 — Single-read native wrapper validation
Accepted after failing-before/passing-after independent regressions. Snapshot text
batch length and indexed strings before validation/native conversion, without
using caller-overridable array methods/iterators. Capture native option values
while validating them, preserving depth-before-bytes order. Native receives the
same immutable strings and numeric limits that passed guards. This deliberately
changes extension-API behavior for stateful accessors; it closes silent Unicode
replacement and limit bypasses. Upstream-compatible stringify traversal is not
changed. No claim of sandboxing hostile global runtime mutation.

## ADR 012 — Inspect actual packed candidate identities
CI candidate schema2 binds selected runtime/declaration/license/docs and target
binary bytes from the tarball, verifies architecture headers and requires all
three actual targets before upload. Installed files and actual loaded local addon
must match the packed hashes. Header inspection never substitutes for execution
on a target. Strict installed TS checks no longer skip declaration checking.
Old schema1 candidate evidence remains immutable; new checks use new candidate
folders. A host-only artifact must fail the combined gate rather than receive
synthetic foreign binaries.
