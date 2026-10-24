# Session handoff

- Branch: `rewrite/v2` (from `master` at 39ef120). No push, publication or release.
- Phase: v2 engine, binding, API, tests, benchmarks and docs complete locally on
  Windows x64. Review findings fixed.
- Active task: none.
- Next: push the branch so CI runs on Linux x64 and macOS ARM64 with Node 22.13
  and 24 (V2-CI, needs approval). Then decide on V2-FLOAT: either approve the
  `ryu-js` crate (formats doubles exactly like JavaScript, no dependencies of its
  own) or hand-write a Ryu-family formatter.
- Passing: `pnpm check` (build, rustfmt, clippy pedantic, 13 Rust tests, 22 JS
  tests, strict types) on Node 24.22.1; the 22 JS tests on Node 22.13.0;
  `pnpm test:pack` with consumers on both runtimes.
- Failing: none. Known slower cases are in REGRESSIONS.md.
- Benchmarks: medians of three pinned runs in docs/performance.md. Run benchmarks
  pinned to the performance cores; an unpinned background run was invalid.
- The 0.1 addon for comparison lives at `target/baseline/old.node` (untracked);
  rebuild it from `master` if missing.
