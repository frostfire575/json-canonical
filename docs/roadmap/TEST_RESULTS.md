# Test evidence

2026-10-19 Windows x64, Node 24.20.0, Rust 1.98.1: implementation tests NOT RUN
at bootstrap. Subsequent milestones append commands and actual results here.

## 2026-10-19 MVP (Windows11 x64, Node24.20.0, rustc1.98.1)
- `pnpm build:native`: PASS release build, napi3.14.2, CLI3.10.8/MSVC linker.
- `cargo test --locked`: PASS3 unit tests,0 doc tests (independently repeated).
- `cargo fmt --all --check`: PASS.
- `cargo clippy --all-targets --locked -- -D warnings`: PASS.
- `pnpm build:js`: PASS after adding explicit Node types for TS7.
- `pnpm test:types`: PASS CJS/ESM strict declarations after fixing ESM default type.
- `pnpm test`: PASS24 Node tests; includes all16 upstream assertions,6000 generated
  exact JS oracle cases,3000 native text cases and11 independent review tests.
- Reviewer `node --test tests/review.test.cjs`: PASS11 adversarial tests including
  comparator observable events, malformed input, array cycles, Unicode and deep
  native input (129,10000,100000 levels in child processes).
- Initial test trace false failure: independent callback objects were compared
  by identity; replaced log values with observable keys/type markers.
- Linux/macOS runtime tests: NOT RUN locally; hosted CI required.
- Packed installation/audit/full benchmarks: NOT RUN at this milestone.

Reproduce: `pnpm check`. Review details: INDEPENDENT_REVIEW.md; tests live in tests/.

## 2026-10-19 borrowed scanner and packaging candidate
- `pnpm check`: PASS release build, Rust3, Node27 (including14 independent review
  tests and2000 additional lexical documents), strict CJS/ESM consumer types.
- `node --test benches/harness.test.cjs`: PASS4, provenance checksums included.
- `cargo clippy --all-targets --locked -- -D warnings`: PASS after annotating
  test-only helper dead-code in the standalone stage benchmark harness.
- `cargo fmt --all --check`: PASS.
- `pnpm test:pack`: PASS offline install with scripts disabled; CJS/ESM/native
  text+batch calls. Tarball retained at
  `.pack-test/1792368342034-568/stable-json-rs-0.1.0.tgz` (ignored build artifact).
- `node scripts/setup-upstream.cjs`: PASS pin and read-only checkout verification.
- Independent scanner source/re-execution review: PASS, see INDEPENDENT_REVIEW.md.
- Cross-platform CI executions remain NOT RUN (no remote push authorized).

## 2026-10-19 selection and final dependency notices candidate
- `pnpm check`: PASS Rust5, Node33, strict types; JS includes14500 generated inputs
  across compatibility/native lexical/selection cases and16 upstream assertions.
- Independent selection review:3500 generated paths plus invalid siblings, array
  grammar, rawlexemes, Unicode and20000element array; see INDEPENDENT_REVIEW.md.
- `cargo clippy --all-targets --locked -- -D warnings`: PASS.
- `pnpm licenses:generate`: PASS38 packages after resolving missing napi crate
  LICENSEtext from pinned workspace commits; THIRD_PARTY_NOTICES.txt distributed.
- `pnpm audit:deps`: PASS pnpm zeroadvisories and OSV38lockedcratequeries nohits;
  inventory and raw responses in docs/audits/2026-10-19T00-06-38-891Z.
- `pnpm test:pack`: PASSselect plusCJS/ESM/native+thirdpartynotices;
  artifact `.pack-test/1792368713493-11320/stable-json-rs-0.1.0.tgz`.
- Selection performance acceptance NOTRUN at this milestone.

## 2026-10-19 minimum runtime, installer and CI definition checks
- `scripts/verify-node22.ps1`: PASS Node22.13.0,33 tests and release native addon
  loading. Official nodejs.org Windows archive verified against SHASUMS256.txt;
  download is local under ignored.tools/. Repeated literal test-glob invocation
  `.tools/node-v22.13.0-win-x64/node.exe --test tests/*.test.cjs tests/*.test.mjs`
  also PASS33, confirming CI command works on the minimum runtime.
- `pnpm test:pack --npm`: PASS offline npm install, lifecycle scripts disabled,
  CJS/ESM/native selection/sorting/batch plus bundled third-party notices. Artifact
  `.pack-test/1792368954361-27280/stable-json-rs-0.1.0.tgz` retained locally.
- `node --test benches/harness.test.cjs`: PASS5 including raw/scalar selection
  worker consumption of zero and boolean values.
- `.tools/actionlint/actionlint.exe -color .github/workflows/ci.yml`: PASS exit0,
  actionlint1.7.12 Windows archive checksum verified against official release
  checksums (6e7241b51e6817ea6a047693d8e6fed13b31819c9a0dd6c5a726e1592d22f6e9).
- Docker client29.7.2 exists but Linux daemon unavailable; WSL only docker-desktop.
  Linux/macOS runtime gates remain NOT RUN.

## 2026-10-19 clean checkout and packed declaration validation
Fresh isolated Git worktree `.verification/fresh` at37a969c, same Windows/Node24/Rust1.98:
- `node scripts/setup-upstream.cjs`: PASS fresh clone pinned/detached49e230d.
- `pnpm install --frozen-lockfile --offline`: PASS198 packages,0 downloads.
- `pnpm check`: PASS new release build,Rust5,Node33,strict TS.
- `cargo fmt --all --check`: PASS.
- `cargo clippy --all-targets --locked -- -D warnings`: PASS.
- `node --test benches/harness.test.cjs`: PASS5 including exact fixture hashes.
- `pnpm licenses:generate`; `git diff --exit-code -- THIRD_PARTY_NOTICES.txt`: PASS.
- `pnpm test:pack --npm`: PASS fresh offline artifact runtime installation.
- `git status --short`: empty (generated outputs match tracked sources).

Additional root packed-consumer tests after extending script:
- `pnpm test:pack --npm`: PASS runtime APIs + packed CJS/ESM strict TS consumers;
  artifact `.pack-test/1792369141208-27252/stable-json-rs-0.1.0.tgz`.
- `pnpm test:pack`: PASS same runtime/types via pnpm; artifact
  `.pack-test/1792369142141-29916/stable-json-rs-0.1.0.tgz`.
- Initial TypeScript7 bin subpath resolution failed; fixed using exported package
  manifest's bin entry. Both installer checks then reran successfully.

NOT RUN: Linux/macOS runtime jobs, combined three-platform package installation,
Rust1.88 compiler execution, long-duration fuzzing and native allocation-count
profiling. Those are not counted as passing.

## 2026-10-19 independent continuation (source113a8eb, perf/independent-reproduction)
Environment reconfirmed: Windows x64,i7-12700K,Node24.20.0,pnpm12.10.1,Rust1.98.1.
- `pnpm check`: PASS fresh release build,5 Rust/33 JS/strict TS before timing.
- `node --test benches/harness.test.cjs`: PASS5.
- `cargo fmt --all --check`; `cargo clippy --all-targets --locked -- -D warnings`: PASS.
- Independent reproduction runner self-tests: PASS4;34 exact output prechecks and
  76 measured-cell exact-output checks. REPRODUCTION_REVIEW.md links raw records.
- `node --test tests/expanded-compatibility.test.cjs`: PASS10 groups; `pnpm test`:
  PASS43 groups; `cargo test --locked`: PASS5; `pnpm test:types`: PASS. Independent
  commands and scope in COMPATIBILITY_REVIEW_2.md. One diagnostic regex corrected
  to documented native InvalidArg contract; no source behavior changed.
- Final-candidate verifier Windows Node24.20.0/22.13.0, npm AND pnpm, offline with
  scripts disabled: PASS installed CJS/ESM/types/native. Checksum identity retained;
  missing all-target binary negative test fails as intended. See CI_REVIEW_2.md.
- Updated CI `actionlint` and new verifier `node --check`: PASS. Hosted matrix and
  actual Linux/macOS installs remain NOT RUN.

## 2026-10-19 expanded reproduction and diagnostic checkpoint
- Independent historical coverage: 404 measured cells with candidate-specific
  exact checks (JSON.stringify rows are contextual, not stable-equivalent),
  seven runner tests, two randomized runs, raw manifests and frozen sources in
  benches/reproduction/results; detailed table in REPRODUCTION_REVIEW.md.
- `cargo fmt --manifest-path benches/profiling/Cargo.toml --all`: PASS.
- Private release addon build and `cargo clippy --manifest-path
  benches/profiling/Cargo.toml --all-targets --all-features -- -D warnings`: PASS.
- `node benches/profiling/batch.cjs`: PASS18 exact stage checks,9x100ms samples.
- Allocation binary release build + `node benches/profiling/allocations.cjs`: PASS
  four inputs. Rust allocation counts only; Node/V8 allocations excluded.
- Filtered stage rerun `PROFILE_DATASETS=unicode,dependency-lock,tiny
  PROFILE_METHODS=serde-validation-stored,scan-sort-drop-stored node
  benches/profiling/run.cjs`: PASS. Raw source snapshots and observations retained.
- New native-output tests not yet executed at this checkpoint; production unchanged.
- New output-density/token-preservation2 groups and7 reproduction harness tests:
  `node --test benches/reproduction/reproduction.test.cjs tests/native-output.test.cjs`
  PASS9 on unchanged production baseline before candidate changes.

## 2026-10-19 output candidates (Windows x64 Node24.20.0 Rust1.98.1)
- Candidate1 `pnpm check`: PASS5Rust45JS/TS; root clippy PASS; independent
  `node --test tests/output-review.test.cjs`: PASS3. Performance gate FAIL on
  sparse Unicode; not adopted. Failure evidence in REGRESSIONS.md.
- Revised bounded-sampling candidate2 `cargo fmt --all; pnpm check`: PASS5Rust,
  48JS,strictTS; `cargo clippy --all-targets --locked -- -D warnings`: PASS;
  private crate clippy all-targets/all-features/locked: PASS.
- Both private predicate probe runs PASS exact boolean route checks; retained raw
  sources/samples; no unverified speedup counted as achieved public performance.

## 2026-10-19 final source validation (candidate96ba87bcc9a76f9c...)
Windows x64 Node24.20.0,Node22.13.0,Rust1.98.1,pnpm12.10.1.
- `pnpm check`: PASS release build,5Rust tests,49JS tests,strictTS.
- `./scripts/verify-node22.ps1`: PASS49JS;0failures,0skips.
- `node --test benches/harness.test.cjs benches/reproduction/reproduction.test.cjs`:
  PASS12. These self-tests run after the isolated performance window ended.
- `cargo fmt --all --check`; `cargo clippy --all-targets --locked -- -D warnings`:
  PASS. Private crate all-target/all-feature locked clippy also PASS.
- `.tools/actionlint/actionlint.exe -color`: PASS; `node --check
  scripts/verify-ci-candidate.cjs`: PASS.
- `pnpm licenses:generate`; `git diff --exit-code -- THIRD_PARTY_NOTICES.txt`:
  PASS,38locked Rust notices unchanged. No production dependency changed.
- Revised independent review:4PASS; repeated benchmark208cells exactPASS; original
  source/SHA and overrides recorded explicitly. Candidate1performancefailure retained.
- Final package consumers and hosted3target jobs not counted here; package checks
  follow below, actual Linux/macOS execution remains NOT RUN.

## 2026-10-19 final packaged output candidate (source ee4b51b)
Environment: Windows11 x64,i7-12700K; Node24.20.0 and22.13.0;pnpm12.10.1;
Rust1.98.1. No production code changed after the source checks above.

Commands actually executed:
1. `pnpm pack --pack-destination .verification/final-output-ee4b51b`: PASS, once.
2. `node scripts/verify-ci-candidate.cjs manifest .verification/final-output-ee4b51b`
   and `prepare` with the same directory: PASS.
3. In that directory's fresh npm consumer: `npm install --offline --ignore-scripts
   --no-audit --no-fund ./candidate.tgz`: PASS.
4. In its fresh pnpm consumer: `pnpm add --offline --ignore-scripts ./candidate.tgz`:
   PASS. No Rust build or lifecycle script in either installation.
5. `node scripts/verify-ci-candidate.cjs verify .verification/final-output-ee4b51b`:
   PASS npm+pnpm installed CJS/ESM/native/strictTS consumers on Node24.20.0.
6. `.tools/node-v22.13.0-win-x64/node.exe scripts/verify-ci-candidate.cjs verify
   .verification/final-output-ee4b51b`: PASS both consumers on Node22.13.0.
7. `node --check scripts/verify-installed-identity.cjs`: PASS.
8. `node scripts/verify-installed-identity.cjs .verification/final-output-ee4b51b`:
   PASS both consumers'8runtime/declaration/loader/native identities; actual local
   .node loads recorded. Independent reviewer repeated on both Node versions and
   independently extracted the tar binary via a binary-safe tar child-process
   buffer; SHA matches compiled and installed artifacts. PACKED_OUTPUT_REVIEW.md.

Tarball SHA256:644220b6316efacad54546c124e1e1260efc18679a54ff9eef724f6c96232fff.
Native SHA256:96ba87bcc9a76f9c2cce21cede7ef74ea10e69b147a69b5435536f1ce81c5f86.
Four runtime/installer reports, manifest and append-only source-identity records
are copied into docs/roadmap/evidence/final-output-ee4b51b/ for persistent evidence.
Large tarball remains in the ignored local candidate directory. All four reports
bind the SAME tarball. Dense Unicode/Latin1/codeunits/raw escaped-surrogate tokens,
batch errors, all public APIs and packed conditional declarations are exercised.

The allowlist now ships public docs and benchmark summaries; full benchmark
sources/raw corpora remain development-checkout material. Local candidate is
Windows-only. Combined tarball, hosted transfers, Linux/macOS runtimes and Rust1.88
execution remain NOT RUN/UNVERIFIED. No push, publication or release occurred.
- Additional minimum-runtime CLI check: `.tools/node-v22.13.0-win-x64/node.exe
  --test 'tests/*.test.cjs' 'tests/*.test.mjs'`: PASS49; explicit quoted glob
  handling works on this minimum Windows runtime. No test-runner change required.

## 2026-10-19 production-readiness source validation
Environment unchanged: Windows x64,i7-12700K,Node24.20/22.13,Rust1.98.1,pnpm12.10.1.
- Independent failing baselines: batch review7groups5PASS/2FAIL; option-limit
  regression review9groups8PASS/1FAIL. See READINESS_SECURITY_REVIEW.md.
- `pnpm check` after both fixes: PASS release build,5Rust,62JS,strictTS.
- `./scripts/verify-node22.ps1` after both fixes: PASS62JS,0failures/0skips.
- Independent security-only reruns:9groupsPASS on EACH Node22 and24.
- `node --test tests/candidate-verifier.test.cjs`: PASS4 (also infullsuite).
  Unit archive includes actual host addon only; expectedmissing-combined gate
  failure is verified, not a combinedpackage success claim.
- `cargo fmt --all --check`; `cargo clippy --all-targets --locked -- -D warnings`:
  PASS. `node --test benches/harness.test.cjs benches/reproduction/reproduction.test.cjs`:
  PASS12. Local actionlint and verifier syntax checks PASS.
- Fresh `pnpm audit:deps`: PASS,0npmadvisories,0OSVmatches38locked crates; raw
  artifacts docs/audits/2026-10-19T01-21-02-497Z. No dependency upgrades made.
- Public-API benchmark runner selftests4PASS (agent-owned; no timings yet).
- Current combined-native runtime/package check remains NOTRUN: no Linuxserver,
  macOS host or foreign addon available. Preparedschema2gate rejectsabsence.

## Installed readiness benchmark candidate and independent harness
2026-10-19, same Windows environment; source757bc26. Commands executed:
- pnpm pack --pack-destination .verification/readiness-benchmark-01: PASS once.
- node scripts/verify-ci-candidate.cjs manifest .verification/readiness-benchmark-01
  and prepare with that path: PASS schema2, genuine host addon only.
- npm install --offline --ignore-scripts --no-audit --no-fund --cache
  D:/misc/npm/stable-json-rs/.verification/npm-cache ./candidate.tgz in npm consumer:
  PASS; pnpm add --offline --ignore-scripts --store-dir
  D:/misc/npm/stable-json-rs/.verification/pnpm-store ./candidate.tgz in pnpm: PASS.
- node scripts/verify-ci-candidate.cjs verify .verification/readiness-benchmark-01:
  PASS both consumers Node24.20; same command with
  .tools/node-v22.13.0-win-x64/node.exe: PASS both Node22.13.
  CJS/ESM, strict CTS/MTS declarations, native loading, token/Unicode/errors and
  new batch/limit regressions execute against installed package, no build scripts.
- node scripts/verify-installed-identity.cjs .verification/readiness-benchmark-01:
  PASS source/packed/installed/loaded identities. Native96ba87... matches releaseDLL.
- PUBLIC_API_CANDIDATE=.verification/readiness-benchmark-01 with node
  benches/public-api/run.cjs:84object cells PASS; PUBLIC_API_BATCH=1:6PASS;
  PUBLIC_API_TEXT=1, batch unset:24PASS. All114 exact outputs checked before/after.
  Raw paths/commands/machine/samples in BENCHMARK_HISTORY.md and public API review.
- Final PUBLIC_API_CANDIDATE-selected node --test benches/public-api/run.test.cjs:
  6PASS; node --check on run.cjs/run.test.cjs PASS. Final guards don't change frozen
  measured source snapshots. No release-platform gate inferred from these checks.

## Final documentation candidate, 2026-10-19
Environment: Windows11 x64/i7-12700K,Node24.20.0 and22.13.0,pnpm12.10.1,
Rust1.98.1; sourcefc006f9 (runtime unchanged from757bc26). Commands executed:
1. pnpm pack --pack-destination .verification/readiness-final-01: PASS once.
2. node scripts/verify-ci-candidate.cjs manifest .verification/readiness-final-01
   and prepare with the same path: PASS schema2.
3. In npm consumer: npm install --offline --ignore-scripts --no-audit --no-fund
   --cache D:/misc/npm/stable-json-rs/.verification/npm-cache ./candidate.tgz: PASS.
   In pnpm: pnpm add --offline --ignore-scripts --store-dir
   D:/misc/npm/stable-json-rs/.verification/pnpm-store ./candidate.tgz: PASS.
   Both isolated consumers contain no Rust/compiler setup or lifecycle execution.
4. node scripts/verify-ci-candidate.cjs verify .verification/readiness-final-01:
   PASS npm+pnpm CJS/ESM/native/strict CTS+MTS on Node24.20.0.
5. .tools/node-v22.13.0-win-x64/node.exe scripts/verify-ci-candidate.cjs verify
   .verification/readiness-final-01: PASS both installers on Node22.13.0.
   Token/Unicode/errors/all APIs and new batch/limit regressions execute installed.
6. node scripts/verify-installed-identity.cjs .verification/readiness-final-01:
   PASS8source runtime/loader/declaration/native identities and loaded paths.
7. node scripts/verify-ci-candidate.cjs verify .verification/readiness-final-01
   --all-targets: EXPECTED_REJECTION (exit1, missing genuine Linux native artifact).
   Negative report preserves stderr and command; not counted as combined success.
8. Lead Node stdin comparison of final and measured schema2 manifest entries:
   PASS12runtime/package/license identities (all entries except README/performance
   documentation). Candidate digests differ only with changed documentation/archive.
   See runtime-equivalence.json. Timing not repeated for byte-identical runtime.
9. Independent reviewer binary-safe tar extraction, installed/loaded actual addon,
   compiled releaseDLL and benchmark candidate comparisons: PASS on Node24;
   inspects all4Node22/24reports. See independent-review-*.json and security review.
   Review harness accounted for pnpm's known packageManager omission/formatting;
   packed/installed/benchmark manifest bytes still match exactly.
10. Final lead PUBLIC_API_CANDIDATE=.verification/readiness-benchmark-01 node
    --test benches/public-api/run.test.cjs:6PASS,0fail/skip. Actionlint and node
    --check on verifier/run/run.test: PASS. No runtime code edited after fullchecks.

Final tar SHA256:b424ebbc68d01fe6031ed40d8d17ecc9e1f459cce5bd84f5296cba042956957a.
Native SHA256:96ba87bcc9a76f9c2cce21cede7ef74ea10e69b147a69b5435536f1ce81c5f86.
Persistent compact reports: docs/roadmap/evidence/readiness-final-01/. Actual tar
remains ignored locally. This host-only package is NOT a verified combined release.
Hosted jobs, Linux/macOS native execution and Rust1.88 remain NOTRUN/UNVERIFIED.
No push, publication or release performed. Later changes are roadmap/evidence only;
final candidate docs preserve the preverification checkpoint, not recursive reports.
