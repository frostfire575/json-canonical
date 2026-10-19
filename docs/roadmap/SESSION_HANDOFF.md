# Session handoff

- Current phase: production-readiness verification; source stable, final documentation pack in progress.
- Branch: chore/production-readiness; master unchanged, no remote actions.
- Last completed task: release source757bc26 independently reviewed and tested;
  schema2 readiness-benchmark-01 installed npm/pnpm offline on Windows Node22/24;
  114 installed API comparison cells completed with exact output checks.
- Currently active task: RD-PACK final documentation candidate; RD-DOCS final evidence.
- Next recommended task: pack once into a NEW readiness-final-01 directory,
  run manifest/prepare, offline npm/pnpm installs and both Node versions;
  compare final runtime bytes to measured candidate and persist reports. Then
  actual hosted target execution is blocked; do not push/publish/release.
- Files changed: JS wrapper single-read input/option snapshots;9security regression
  groups; schema2 verifier and4negative/integrity tests; pinned three-target CI;
  installed benchmark harness/raw reports; public per-API docs/audits/roadmap.
- Tests passing:5Rust;62JS on EACH Windows Node22.13.0/24.20.0; strictTS;
  25,740 seeded cases and16upstream assertions; independent9security groups on
  both runtimes;12legacy harness and6installed-public harness tests; release
  addon/rustfmt/clippy; actionlint1.7.12; fresh dependency/license audit;
  four actual benchmark-candidate CJS/ESM/types/native installed reports and
  packed/installed/loaded/source identities. Audit zero npm/OSV matches38crates.
- Tests failing: none in shipped source. Initial batch/limit expected failures
  preserved in REGRESSIONS.md. Missing-combined gate is an expected rejection.
- Latest benchmark results:114current cells: compatible CJS/ESM stringify/alias
  has no repeatable >=10% gain on any of seven real inputs. Existing-text lock
  native3558/3451 vsparse+upstream1427/1393ops/s; CLDR9569/9311 vs5165/5110.
  Full object-native CLDR6186/6213 vsupstream7620/7894 (19-21%slower).
  Native batch34913/34898 vsloop36397/37643batches/s (4-7%slower).
  Historical cache misses3-5%slower,50%hits~1.8x,90%~7.3-7.7x; not remeasured.
  See PUBLIC_API_PERFORMANCE_REVIEW.md and benches/public-api/results for all
  CJS/ESM/alias/roundtrip/selection columns, samples/MAD and source identities.
- Outstanding problems: Linux/macOS and combined package build/load/install NOTRUN;
  Docker has no server, no macOS host, git remote empty. Hosted workflow cannot
  run locally. Rust1.88 declaredminimum NOTRUN (1.98.1 verified). No public V8
  allocation counts/internal stacks or serializer-only memory peak measurement.
- Architectural decisions: compatible traversal remains JS, no native calls;
  native API sorts bounded existing text and preserves scalar tokens, not JCS.
  Bounded lossless UTF16 output route unchanged. Native batch snapshots indexed
  values once; option limits read once in validation order. Batch retained for
  ordered/bounded semantics, no speed claim. Cache requires explicit versions;
  no automatic mutation detection. Parse/stream/async/hash remain deferred.
- Relevant Git commit:757bc263d0ce9c6774da5fd68e3f7b9935e152ef is tested library
  source and benchmark candidate source. Next CI/docs/evidence commit changes
  no runtime source. Use git log -4 --oneline for final evidence HEAD.
- Measured local candidate:.verification/readiness-benchmark-01/stable-json-rs-0.1.0.tgz
  SHA256:66e82b265c2e3dfb3edfe7220c1b2c63a0506e453612d7c8884f95f7e7667017.
  Native SHA256:96ba87bcc9a76f9c2cce21cede7ef74ea10e69b147a69b5435536f1ce81c5f86.
  Persistent reports:docs/roadmap/evidence/readiness-benchmark-01/.

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
node scripts/verify-ci-candidate.cjs verify .verification/readiness-benchmark-01
.tools/node-v22.13.0-win-x64/node.exe scripts/verify-ci-candidate.cjs verify .verification/readiness-benchmark-01
node scripts/verify-installed-identity.cjs .verification/readiness-benchmark-01
.tools/actionlint/actionlint.exe .github/workflows/ci.yml
```
Ignored candidates/tools must exist for these exact local paths. For recreation,
pack into a NEW directory, never overwrite old manifests/raw reports. Use schema2;
older schema1 candidates are historical and cannot use the current verifier.
Benchmark timing requires explicit PUBLIC_API_CANDIDATE and runs serially, with
no other builds/tests. Read benches/public-api/README.md before measurement.
Current reports are WindowsNode24 performance only; Node22 correctness is separate.
