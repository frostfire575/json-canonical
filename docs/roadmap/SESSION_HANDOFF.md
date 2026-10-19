# Session handoff

- Current phase: independent reproduction complete; native encoding and batch profiling active.
- Prior baseline completed task: fresh Git worktree rebuild; npm/pnpm packed runtime and TS
  consumer verification; minimum Node22.13.0 checks; local integration merge.
- Currently active task: private dev-only napi encoding/stage probes. No production
  serializer optimization adopted yet. See R1..R5 continuation tasks.
- Next recommended task: measure and independently validate a justified Unicode
  optimization, complete batch/cache utility evaluation, then execute hosted
  Linux x64/macOS ARM64 CI and install the
  combined candidate on each target when a remote workflow is authorized. Until
  then, use the verified Windows candidate and preserve documented scope.
- Files changed: Cargo.lock/Toml/build.rs, src/{lib,engine,tree,selection}.rs,
  typed JS wrappers/conditional declarations, native generated loader, tests,
  benches/{fixtures,harness,reports,raw results}, scripts, CI, notices and docs.
- Tests passing: fresh baseline5 Rust/33 JS/types; expanded independent suite43 JS
  on Node24.20.0 with25740 generated cases; installed candidate Windows22/24. Earlier
  full baseline33 JS on Windows Node24.20.0 AND22.13.0,14500 generated
  cases and16 upstream assertions;18 independent review tests;5 harness tests;
  strict CJS/ESM types including packed consumers;rustfmt/clippy;release build;
  offline npm/pnpm package installs;dependency/license checks;actionlint.
- Tests failing: none. Historical failures and fixes: TEST_RESULTS.md/REGRESSIONS.md.
- Latest benchmark results: native existing-text lock3377 vs JS parse+upstream1338
  ops/s;real API231 vs137;deep72084 vs31470;Unicode4432 vs13134. Native batch3.2%
  slower than same-native loop. Select lock6789 vs JS4556;API513 vs681. Two longer
  confirmations, exact outputs, source/artifact hashes and all unfavorable results
  preserved in benches/REPORT.md and results/. No universal speed claim.
- Outstanding problems: Linux/macOS runtime and combined package NOT RUN;Docker
  daemon unavailable,WSL only docker-desktop;no macOS host. Rust1.88 minimum NOT RUN
  (1.98.1 verified). No known critical defect in reviewed scope. Unicode-heavy native
  text and most selective workloads lose to JS. Full parse/stream/async/hash deferred.
- Architectural decisions: compatibility API deliberately stays in JS; native APIs
  process existing JSON text with explicit token/Unicode/duplicate/limit semantics.
  Single serde validation precedes borrowed scanning. Selection uses raw visitors.
  Cache requires explicit versions. CI bundles target binaries without publishing.
- Exact commands required to resume (after reading AGENTS and roadmap):
  `git status --short`; `git log -5 --oneline`; `pnpm install --frozen-lockfile`;
  `pnpm setup:upstream`; `pnpm check`; `node --test benches/harness.test.cjs`;
  `pnpm test:pack --npm`; `pnpm test:pack`; `pnpm audit:deps` when refreshing audits.
  `pnpm bench` reproduces full matrix; use raw configuration overrides for longer
  confirmations. Optional `scripts/verify-node22.ps1` repeats minimum runtime tests.
- Prior baseline Git commit reference: fresh source37a969c;select991e97c;scanner28326e7;
  baseline9c4a1fe. Final evidence commit follows37a969c. Local branch master contains
  feat/native-mvp after fast-forward; feature branch retained. No remote actions.

## Latest continuation checkpoint, 2026-10-19
- Branch: perf/independent-reproduction, verified source6da938b; next commit records
  full independent reproduction and private stage/allocation probes.
- Last completed:404 measured cells,7 independent harness tests; private release
  probes/clippy; Rust allocation counts on4 inputs. New native-output2 groups PASS
  on unchanged production release; combined reproduction+output9 tests PASS.
- Current: output-only adaptive UTF16 candidate, not implemented at checkpoint.
- Next: release build/all tests, independent matched2run controls/core comparisons;
  then evaluate batch fallback separately, final pack/lint/minimumNode checks.
- Latest results: lock corroborated; dense Unicode output conversion dominates;
  real batch slower3–33%; cache50%hits~1.8x,90%~7.3–7.7x,misses3–5%slower.
- Files: benches/reproduction expanded runner/snapshots/raw/manifests; profiling
  dev-only crate/data/raw/source snapshots; tests/native-output; evidence docs.
- Commands: node --test benches/reproduction/reproduction.test.cjs tests/native-output.test.cjs;
  node benches/reproduction/coverage.cjs encoding-controls; private profiler README.
- No test failures outstanding. Linux/macOS actual hosted jobs still NOT RUN.
