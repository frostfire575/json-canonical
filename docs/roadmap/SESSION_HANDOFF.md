# Session handoff

- Branch: `main`, the default branch of the public repository
  github.com/frostfire575/json-canonical (renamed from stable-json-rs on 2026-10-24). The rewrite started on `rewrite/v2` from
  the 0.1 commit 39ef120. Published as `json-canonical@0.2.0` and 0.2.1 on 2026-10-24.
- Phase: v2 engine, binding, API, tests, benchmarks and docs complete locally on
  Windows x64. Review findings fixed.
- Active task: none. Releases run through release-please inside release.yml:
  every push to main updates the release PR, and merging it tags, verifies on
  all platforms and publishes through the npm trusted publisher
  (frostfire575/json-canonical, release.yml, no token). `json-canonical@0.2.1`
  was the first OIDC publish on 2026-10-24. The repository setting "Allow GitHub
  Actions to create and approve pull requests" must stay on.
- `equal` is slower than `isDeepStrictEqual` (REGRESSIONS.md); no task for it yet.
- Passing: `pnpm check` (build, rustfmt, clippy pedantic, 14 Rust tests, 29 JS
  tests, strict types) on Node 24.22.1; the 29 JS tests on Node 22.13.0;
  `pnpm test:pack` with consumers on both runtimes.
- Failing: none. Known slower cases are in REGRESSIONS.md.
- Benchmarks: medians of three pinned runs in docs/performance.md. Run benchmarks
  pinned to the performance cores; an unpinned background run was invalid.
- The 0.1 addon for comparison lives at `target/baseline/old.node` (untracked);
  rebuild it from commit 39ef120 if missing.
