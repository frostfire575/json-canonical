# Session handoff

- Current phase: local production-readiness verification complete; foreign-platform release gates blocked.
- Branch: chore/production-readiness. Master unchanged; no push/publication/release.
- Last completed task: final current-runtime documentation tarball independently
  verified through actual offline npm/pnpm installs on Windows Node22.13/24.20;
  CJS/ESM/strict declarations/native loading, single-read regressions and hashes.
- Currently active task: none executing. RD-BATCH/RD-CI/RD-PACK/RD-PUBLIC/RD-REVIEW/
  RD-DOCS verified DONE. R4-PACKAGE/P7-TARGETS/P7 remain BLOCKED.
- Next recommended task: execute prepared three-target native-build and six
  target/Node consumer CI jobs when remote execution is authorized. Install the
  same genuine combined tarball on Windows x64/Linux x64/macOS ARM64, BOTH Node
  versions with BOTH installers. Do not infer hosted success from local lint.
  Keep advanced features deferred; no new features needed before release gates.
- Files changed: JS single-read batch/limit snapshots;9security regressions;
  schema2 packed/installed/loaded verifier and4integrity/negative tests; immutable
  reviewed CI action pins; installed benchmark runner/snapshots/raw reports;
  per-API docs/audits/roadmap and compact final artifact evidence.
- Tests passing:5Rust;62JS on EACH Windows Node22.13.0/24.20.0; strictTS;
  25,740 seeded cases and16upstream assertions; independent9security groups on
  both runtimes;12legacy and6installed-public harness tests; release native build,
  rustfmt/clippy/actionlint1.7.12; fresh audit (0npm/0OSV matches38locked crates,
  license inventory reviewed). Final same-tarball4installed CJS/ESM/types/native
  reports PASS;8source-runtime identities and12measured-runtime/package/license
  hashes PASS. Independent reviewer verifies actual extracted/installed/loaded
  native bytes match compiled releaseDLL and measured candidate.
- Tests failing: none in shipped source. Initial batch/limit failures and rejected
  prior output experiment preserved. Actual --all-targets rejection is EXPECTED:
  missing genuine Linux/macOS artifacts; not counted as combined verification.
- Latest benchmark results:114current WindowsNode24 cells (84object,6batch,
  24text/selection),2shuffled fresh-process runs,1s warmup,9samples per cell.
  Compatible installed CJS/ESM stringify/alias has no repeatable >=10% gain on
  any of seven real inputs. Existing-text lock3558/3451 vsparse+upstream1427/1393
  ops/s; CLDR9569/9311 vs5165/5110. Full object-native CLDR6186/6213 vsupstream
  7620/7894 (19-21%slower). Native batch34913/34898 vsloop36397/37643batches/s
  (4-7%slower). Historical cache misses3-5%slower,50%hits~1.8x,90%~7.3-7.7x;
  not remeasured. PUBLIC_API_PERFORMANCE_REVIEW.md has all exports/roundtrip/
  selection results, median/MAD and caveats; raw machine/source/tar identities in
  benches/public-api/results. Earlier3377/1338 is existing-text only, not a
  compatible stringify claim. Final12runtime/package/license bytes equal measured
  candidate, so114measurements apply without inventing a final-tar timing rerun.
- Outstanding problems: actual Linux/macOS build/load, hosted transfer and combined
  package installation NOTRUN/UNVERIFIED. Docker29.7.2 has no server; WSL only
  docker-desktop; no macOS host; git remote empty. Rust1.88 declared minimum NOTRUN
  (1.98.1 verified). No public V8 allocation counts/internal stacks or serializer-
  only memory peaks; reports disclose process RSS/CPU measurement boundaries.
- Architectural decisions: compatible traversal stays JS without native calls or
  automatic conversion/fallback; native sorts bounded existing text preserving
  scalar tokens, not JCS. Bounded lossless UTF16 output routing unchanged. Batch
  indexed inputs/options captured once. Batch retained for ordered/bounded
  convenience and indexed native-document errors, not speed. Weak cache requires
  caller versions covering all serialization-visible state; no mutation detection.
  Parse/stream/async/hash remain deferred.
- Relevant Git commits:757bc263d0ce9c6774da5fd68e3f7b9935e152ef tested runtime fixes;
  fc006f9efa8516bcb43ca29d5228decf11d9691a CI/benchmark/docs milestone and final
  candidate source. Final evidence commit changes only roadmap/review documents.
  Use git log -4 --oneline for final HEAD.
- Final local candidate:.verification/readiness-final-01/stable-json-rs-0.1.0.tgz
  SHA256:b424ebbc68d01fe6031ed40d8d17ecc9e1f459cce5bd84f5296cba042956957a.
  Native SHA256:96ba87bcc9a76f9c2cce21cede7ef74ea10e69b147a69b5435536f1ce81c5f86.
  Persistent reports:docs/roadmap/evidence/readiness-final-01/ (schema2 manifest,
  4installer/runtime reports, source identity, measured-runtime equality,
  independent extraction/loading review and expected combined rejection).
  Actual tar remains ignored locally; host-only, NOT a verified combined release.
  It includes the preverification roadmap checkpoint; later repository evidence
  does not trigger recursive repacking. README/performance hashes remain bound.
- Measured candidate:.verification/readiness-benchmark-01, SHA256
  66e82b265c2e3dfb3edfe7220c1b2c63a0506e453612d7c8884f95f7e7667017;
  source757bc26. Persistent benchmark-candidate reports live beside final evidence.

## Exact resume commands
Read AGENTS, this handoff, PROGRESS/TASKS/MASTER_PLAN, architecture/compatibility/
decisions and benchmark evidence first. Then:
```powershell
git status --short
git log -5 --oneline
pnpm install --frozen-lockfile
pnpm setup:upstream
pnpm check
./scripts/verify-node22.ps1
node --test benches/harness.test.cjs benches/reproduction/reproduction.test.cjs
$env:PUBLIC_API_CANDIDATE='.verification/readiness-benchmark-01'
node --test benches/public-api/run.test.cjs
node scripts/verify-ci-candidate.cjs verify .verification/readiness-final-01
.tools/node-v22.13.0-win-x64/node.exe scripts/verify-ci-candidate.cjs verify .verification/readiness-final-01
node scripts/verify-installed-identity.cjs .verification/readiness-final-01
.tools/actionlint/actionlint.exe .github/workflows/ci.yml
```
Ignored candidates/tools must exist for these exact local paths. For recreation,
pack into a NEW directory; never overwrite old manifests/raw reports. See
TEST_RESULTS.md for manifest/prepare and installer commands. Use schema2;
older schema1 evidence cannot use the current verifier. --all-targets on the
current host-only tar intentionally fails; it requires genuine3target binaries.
Benchmark timing requires explicit PUBLIC_API_CANDIDATE and serial execution with
no builds/tests; read benches/public-api/README.md first. No current foreign-OS
or Node22 public performance claim. Historical probes have their own environment.
