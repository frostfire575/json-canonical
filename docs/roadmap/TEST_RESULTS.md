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
