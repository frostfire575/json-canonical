# Session handoff

- Current phase: local verification complete; cross-platform release gates blocked.
- Branch: perf/independent-reproduction. Master unchanged; no remote actions.
- Last completed task: independently verify one final packed Windows candidate
  with offline npm/pnpm installs on Node22.13.0 and24.20.0; CJS/ESM/strict types,
  native dense-Unicode/token/error cases and packed/installed/compiled byte identity.
- Currently active task: none executing. R1/R2/R3/R4-CONFIG/R5 are verified DONE.
  R4-PACKAGE/P7-TARGETS remain BLOCKED by unavailable Linux/macOS target runners.
- Next recommended task: execute prepared CI build and final-candidate consumer
  matrices on Windows x64, Linux x64 and macOS ARM64 when remote execution is
  authorized. Install the identical combined tarball on Node22/24 for every target.
  Do not push/publish/release without explicit approval. Keep advanced APIs deferred.
- Files changed: src/output.rs and binding mapping; native declaration; expanded
  compatibility/output tests; independent runner/source snapshots/raw measurements;
  private encoding/batch/allocation probes and pinned CLDR corpus/license;
  pack-once CI/verifier and installed identity tool; package docs allowlist;
  public docs, roadmap and compact candidate evidence JSON.
- Tests passing:5 Rust;49 JS on EACH Windows Node22.13/24.20;25,740 seeded cases
  plus16 upstream assertions and adversarial effects/cycles/large/wide graphs;
  independent output review4 groups;12 benchmark-harness tests; strict TS;
  release build; rustfmt/clippy; actionlint; unchanged38-crate license notices;
  four installed npm/pnpm x Node22/24 CJS/ESM/types/native reports. Independent
  reviewer verifies actual extracted/installed/loaded addon SHA and wrapper hashes.
- Tests failing: none. Rejected performance experiment1 is retained, not shipped.
- Latest benchmark results:404 original independent cells reproduce lock~3.2-3.4k
  vs JS~1.3k ops/s. Revised experiment208 cells: real CLDR +31-32% on24 and
  +34-35% on22 vs original native. Dense synthetic Unicode~4.5k ->8.3-8.5k
  still loses to JS~13.3k; sparse/mixed controls within declared gate. Native batch
  still slower than same-native loops. Version cache: misses3-5% slower,50% hits
  ~1.8x,90% hits~7.3-7.7x. Full samples/MAD/artifact/source hashes in
  REPRODUCTION_REVIEW.md, OUTPUT_BENCHMARK_REVIEW.md and benches/reproduction/results/.
- Outstanding problems: actual Linux/macOS/combined artifact execution NOT RUN;
  Rust1.88 minimum NOT RUN (1.98.1 verified); V8 internal call stacks and public
  allocation peaks unmeasured. Private Rust-only allocator counts are available.
  One short-warmup batch cell~20% low did not reproduce with matched1s warmup;
  no exact cause claimed. Historical failures retained in REGRESSIONS.md.
- Architectural decisions: JS compatibility traversal retained. Rust engine takes
  bounded text, validates once and preserves scalar token spelling. Output uses
  four distributed256-byte samples to choose lossless UTF8/UTF16; no full scan,
  no new production dependency/unsafe code. Native input and selection unchanged.
  Batch retained as bounded convenience, no speed claim; cache requires versions.
  Parse/stream/async/hash remain deferred. CI packs once and verifies same SHA.
- Relevant Git commit:ee4b51b260be4993a7097fcd1624dca2660ad7d5 is the tested library
  source/candidate commit. Final evidence commit follows, adding only verifier
  tooling/reports/status. Use git log -3 --oneline to identify the final HEAD.
- Final local candidate: .verification/final-output-ee4b51b/stable-json-rs-0.1.0.tgz
  (ignored binary; host-only). Tar SHA256:
  644220b6316efacad54546c124e1e1260efc18679a54ff9eef724f6c96232fff.
  Native SHA256:96ba87bcc9a76f9c2cce21cede7ef74ea10e69b147a69b5435536f1ce81c5f86.
  Persistent reports: docs/roadmap/evidence/final-output-ee4b51b/.

## Exact resume commands
After AGENTS.md and roadmap/architecture/compatibility reads:
```powershell
git status --short
git log -5 --oneline
pnpm install --frozen-lockfile
pnpm setup:upstream
pnpm check
node --test benches/harness.test.cjs benches/reproduction/reproduction.test.cjs
./scripts/verify-node22.ps1
node scripts/verify-ci-candidate.cjs verify .verification/final-output-ee4b51b
node scripts/verify-installed-identity.cjs .verification/final-output-ee4b51b
```
Use existing candidate verify commands only if its ignored directory still exists.
For a new candidate, pack into a NEW directory; run manifest/prepare, both offline
installers there, then verify. Commands are recorded in TEST_RESULTS.md. Never
overwrite previous raw/tarball evidence. On target CI, --all-targets is required.
For performance, read benches/reproduction/README.md; run serial with no builds
or concurrent tests. Archived comparison groups require the retained old Windows
addon; normal independent groups do not. Private profiling README documents probes.
