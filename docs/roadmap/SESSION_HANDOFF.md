# Session handoff

- Current phase: native text positioning and local verification complete; foreign release gates blocked.
- Branch: docs/native-text-positioning. Master unchanged. No push, publication or release.
- Last completed task: final tarball installed offline through npm and pnpm on
  Windows Node22.13/24.20; CJS/ESM, strict types, native loading and shipped examples
  pass. Independent extraction confirms measured/packed/installed/loaded identities.
- Currently active task: none executing. NT-REPRO, NT-SEC, NT-DIST, NT-DOCS and
  NT-VERIFY are verified DONE. R4-PACKAGE/P7-TARGETS/P7 remain BLOCKED.
- Next recommended task: execute the prepared three-host build and six OS/Node
  consumer jobs when remote execution is authorized. Build tools use Node24;
  final consumers test both Node22.13 and24 with both installers. Install the same
  genuine combined tarball on Windows x64, Linux x64 and macOS ARM64. No push or
  publication without approval. Keep advanced features deferred.
- Files changed: native-first README/API/performance/architecture/security docs;
  package description, examples allowlist and bench:text; CJS/ESM/TS examples;
  12 independent adversarial groups; native text runner/corpora/raw measurements;
  optional-distribution prototype and bounded tooling diagnostic; Node24 CI build
  hosts and source/installed examples checks; audits, roadmap and final evidence.
- Tests passing: release build,5 Rust,74 JS on EACH Windows Node22.13/24.20;
  strict TypeScript including example;12 legacy,6 prior public and7 new text
  harness groups (new7 on both runtimes); independent12 security groups include
  2,400 lexical documents/19,200 selections and isolated malformed/depth probes.
  rustfmt/clippy/actionlint and fresh advisory/license audit pass (0 npm advisories,
  0 OSV matches for38 locked crates). Actual optional-package prototype7 controls
  pass on each consumer runtime using Node24 metadata generation. Final four
  same-tarball installed CJS/ESM/types/native reports and22 example/probe commands
  pass;11 runtime/license byte identities equal measured candidate. Independent
  reviewer verifies actual tar, examples, installed local addon and release DLL.
- Tests failing: Node22 Windows napi3.10.8 create-npm-dirs metadata generation
  failed in a filesystem identity retry loop. Bounded5s reproduction confirms it;
  Node22 CLI help passes, while Node24 generation passes. Build tools explicitly
  use Node24; actual Node22 consumers pass. Do not mark Node22 generation passed.
  Initial example probes failed Node's node_modules TS stripping restriction and
  TS7 command-line/config coexistence rule; preserved FAIL reports and independently
  reproduced expected rejections. Corrected V3 uses unchanged shipped TS bytes in
  the consumer application and a strict project. No failing product-runtime test.
- Latest benchmark results:162 independent completed cells (108 main+54 paired
  direct-field controls),3 shuffled fresh-process passes,1s warmup,9 samples >=100ms.
  All5 original source files show native sorting gains over parse+upstream:
  lock2392/2397/2339 vs1017/774/1090; API178/172/178 vs115/106/112;
  CLDR6698/6422/5975 vs3988/3937/3972 ops/s. JS lock pass2 MAD16.54% is retained.
  Extraction only normalized lock repeats >=10% over literal direct fields:
  5581/5602/5912 vs3671/3599/3804; original lock gains vary6-13% (not repeated10%);
  all other direct controls lose. Input forms stay separate. Whole-process RSS
  includes setup/oracle/archive/warmup/GC, not isolated allocations or a general
  memory guarantee. No Node22/foreign-OS performance claim. Prior compatible
  stringify has no repeatable >=10% gain and batch is4-7% slower; not retuned.
  Full results: NATIVE_TEXT_REVIEW_2.md and benches/native-text-verification/results/.
- Outstanding problems: actual Linux/macOS build/load, hosted transfer and combined
  installation NOT RUN/UNVERIFIED. No configured Git remote, no Docker daemon or
  macOS host. Rust1.88 declared minimum NOT RUN (1.98.1 verified). No V8 allocation
  counts or isolated serializer peak RSS. Observed Windows22 development CLI
  incompatibility remains documented; no inference that Linux22 has that bug.
- Architectural decisions: stringifyJson(existingText) is the primary measured
  performance API. selectJson is a bounded raw-text tool with narrower measured
  benefits. Compatible stringify/default export remains JS without automatic native
  dispatch. Scalar spellings, duplicates/Unicode traversal, synchronous calls and
  copies remain explicit; no JCS/streaming claim. Batch convenience and explicit
  version cache retained without tuning. Combined root tar preferred; split optional
  packages proved feasible locally but root has no unpublished optional dependency.
  Node24 tools are separate from Node22/24 consumers. Parse/async/stream/hash deferred.
- Relevant Git references: eaf85ba records positioning, independent evidence and
  source checks; b47fbee12b557dc6ce43e2c394326babedaed488 clarifies options accessor
  execution and is the final candidate source. Runtime remains byte-identical to
  757bc26. Final evidence commit changes only roadmap/review records; use git log.
- Final candidate: .verification/native-text-final-01/stable-json-rs-0.1.0.tgz
  SHA256:91982c646f59fe61a28bf0795f3839fb2deab30fac7f8679273c27b501449ff3.
  Native SHA256:96ba87bcc9a76f9c2cce21cede7ef74ea10e69b147a69b5435536f1ce81c5f86.
  Persistent reports/probe sources: docs/roadmap/evidence/native-text-final-01/.
  Host-only archive stays ignored locally; combined --all-targets intentionally
  rejects the absent Linux binary. Candidate contains preverification roadmap;
  later evidence does not recursively repack itself. README/performance hashes bound.
- Measured candidate: .verification/readiness-final-01, SHA256
  b424ebbc68d01fe6031ed40d8d17ecc9e1f459cce5bd84f5296cba042956957a.
  New final candidate has11 identical runtime/license entries; metadata changes
  only description, files adds examples, scripts adds bench:text. Exports, engines,
  dependencies, version and binding bytes unchanged. New timing is not fabricated
  for the documentation archive; recorded162 measurements apply to its runtime.

## Exact resume commands
Read AGENTS, handoff, PROGRESS/TASKS/MASTER_PLAN, architecture/compatibility/
decisions and linked evidence first. Use Node24 for build tools:
```powershell
git status --short
git log -5 --oneline
pnpm check
./scripts/verify-node22.ps1
.tools/actionlint/actionlint.exe .github/workflows/ci.yml
$env:NATIVE_TEXT_CANDIDATE='.verification/readiness-final-01'
node --test benches/native-text-verification/run.test.cjs
node benches/native-text-verification/verify-evidence.cjs benches/native-text-verification/results/2026-10-19T09-56-55-718Z-33544.json
node benches/native-text-verification/verify-evidence.cjs benches/native-text-verification/results/2026-10-19T10-01-50-243Z-33224.json
node scripts/verify-ci-candidate.cjs verify .verification/native-text-final-01
.tools/node-v22.13.0-win-x64/node.exe scripts/verify-ci-candidate.cjs verify .verification/native-text-final-01
node scripts/verify-installed-identity.cjs .verification/native-text-final-01
pnpm exec node scripts/distribution-review/run.cjs
```
Ignored candidates/tools must exist for those paths. Recreate into a NEW directory,
pack once, manifest/prepare and install both consumers; TEST_RESULTS has exact
installer commands. Never overwrite raw reports or candidate manifests. Prototype
commands are bounded; use NAPI_METADATA_NODE=actual Node24 for Node22 consumers,
not an unbounded rerun of failing metadata generation. The V1/V2/V3 example probes
are single-use evidence writers: do not rerun them into an existing report path;
copy a probe into a fresh candidate if needed. Normal verify creates unique reports.
Timing uses explicit candidate and CPU-quiet serial runs; runner README has the
main4/direct2 filters. Unavailable hosted jobs remain release gates, not completed
by local lint, optional-package metadata filtering or native architecture headers.
