# Session handoff

- Branch: `main`, the default branch of the public repository
  github.com/frostfire575/stable-json-rs. The rewrite started on `rewrite/v2` from
  the 0.1 commit 39ef120. No publication or release.
- Phase: v2 engine, binding, API, tests, benchmarks and docs complete locally on
  Windows x64. Review findings fixed.
- Active task: none.
- Next: V2-CI and V2-FLOAT are done. Remaining plan: a CLI, benchmarks for `equal`
  and `canonicalHash`, then V2-RELEASE (needs explicit approval).
- Passing: `pnpm check` (build, rustfmt, clippy pedantic, 14 Rust tests, 22 JS
  tests, strict types) on Node 24.22.1; the 22 JS tests on Node 22.13.0;
  `pnpm test:pack` with consumers on both runtimes.
- Failing: none. Known slower cases are in REGRESSIONS.md.
- Benchmarks: medians of three pinned runs in docs/performance.md. Run benchmarks
  pinned to the performance cores; an unpinned background run was invalid.
- The 0.1 addon for comparison lives at `target/baseline/old.node` (untracked);
  rebuild it from commit 39ef120 if missing.
