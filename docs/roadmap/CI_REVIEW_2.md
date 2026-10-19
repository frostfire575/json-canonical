# Independent CI and combined-candidate review — 2026-10-19

Scope: `.github/workflows/ci.yml`, new `scripts/verify-ci-candidate.cjs`, and this
report. Existing `scripts/test-pack.cjs` and package manifests were not changed.

## Finding and correction

The previous workflow tested each host's development build and host-only tarball,
then combined binaries on Ubuntu. Its final combined tarball was never installed
on Windows or macOS. Even the Ubuntu combined-package test packed a separate
tarball before the final `pnpm pack`. This did not satisfy the exact final-artifact
release gate.

The revised workflow packs the combined candidate once, records the source commit
and tarball SHA-256, and uploads both. A downstream matrix downloads those same
bytes on Windows x64, Linux x64 and macOS ARM64, with Node 22.13.0 and Node 24.
Every job asserts its actual host architecture. Fresh npm and pnpm consumers
install the candidate offline with lifecycle scripts disabled. No native build,
JavaScript build, Rust setup or repacking occurs in these consumer jobs. Locked
development dependencies provide only the existing TypeScript compiler there.

The verifier checks candidate identity, the presence of all three bundled native
files, installed CJS and ESM entry points, native text/batch/selection operations,
cache version invalidation, malformed text errors, attribution, and strict CJS/ESM
TypeScript consumers. Reports identify candidate SHA-256, source commit, manager,
host, Node version and status. Missing native files fail before API smoke checks;
they cannot silently pass through the compatibility API's lazy native loading.

## Runner verification

Rechecked the official [GitHub-hosted runner reference](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)
on 2026-10-19. `macos-15` is documented as ARM64 for both public and private
repositories, `windows-latest` as x64, and `ubuntu-22.04` as x64. Actual runtime
assertions prevent unexpected host changes from passing. Hosted availability,
repository Actions permissions and all remote executions remain **UNVERIFIED**.

## Executed validation

- `.tools/actionlint/actionlint.exe .github/workflows/ci.yml`: PASS, no diagnostics.
- `node --check scripts/verify-ci-candidate.cjs`: PASS.
- Windows host-only candidate installation and runtime/types verification:
  PASS under Node 22.13.0 and 24.20.0, both npm and pnpm; details below.

## Local reproduction

After the existing release addon and JavaScript wrapper have been built:

```powershell
pnpm pack --pack-destination .verification/ci-candidate-local
node scripts/verify-ci-candidate.cjs manifest .verification/ci-candidate-local
node scripts/verify-ci-candidate.cjs prepare .verification/ci-candidate-local
Push-Location .verification/ci-candidate-local/npm
npm install --offline --ignore-scripts --no-audit --no-fund ./candidate.tgz
Pop-Location
Push-Location .verification/ci-candidate-local/pnpm
pnpm add --offline --ignore-scripts ./candidate.tgz
Pop-Location
node scripts/verify-ci-candidate.cjs verify .verification/ci-candidate-local
```

Host-only local reproduction checks the current platform binary. CI additionally
passes `--all-targets` and requires the combined tarball to contain all three.
The directory must be fresh; preparation rejects existing consumer node_modules.

Uploads from the ignored `.verification` directory explicitly set
`include-hidden-files: true` and restrict paths to the candidate tarball,
candidate identity manifest, or verification report JSON. GitHub's
[upload-artifact documentation](https://github.com/actions/upload-artifact#uploading-hidden-files)
documents hidden-file exclusion by default; this avoids silently dropping the
candidate or evidence because of its hidden ancestor directory.

This correction prepares the gate; it does not clear P7-TARGETS. No push, release
or publication occurred.

## Local executed evidence

After the lead confirmed the isolated benchmark window had ended, ran the
reproduction commands above with directory
`.verification/ci-candidate-local-review2`. Both offline installations passed with
scripts disabled. `verify` passed separately under Node 24.20.0 and the local
`.tools/node-v22.13.0-win-x64/node.exe` minimum runtime. Each invocation verified
both installed npm and pnpm consumers, CJS/ESM runtime entry points, the real
Windows release native addon, and strict CJS/ESM TypeScript consumers. Commands
completed with exit code 0; local host is Windows x64. No Rust or wrapper rebuild
was performed for this candidate check.

- Candidate SHA-256:
  `15d627588be29144c7246960f1a8d6fd85195224b31ab0cf60aecf6baca58475`.
- Candidate source HEAD: `113a8eb79dbf7350d1f15a7e639d7a5e2492abee`
  (workflow/verifier changes were still uncommitted; runtime source unchanged).
- Raw manifest and tarball: `.verification/ci-candidate-local-review2/`.
- Four positive raw reports: `verification-{npm,pnpm}-v{22.13.0,24.20.0}-*.json`
  in that directory. Reports are uniquely named and preserved across runs.
- Negative gate: invoking `verify ... --all-targets` against this host-only
  candidate correctly failed on missing `stable-json-rs.linux-x64-gnu.node`.
  A separate assertion checked the nonzero status and exact missing filename;
  this expected failure is retained as an additional FAIL report. This is
  evidence that the combined gate refuses a host-only artifact, not evidence
  that a three-platform artifact has passed.
- Actionlint rerun after hidden-path fix: PASS, exit 0.

Linux/macOS runtime, the actual combined artifact, hosted artifact transfers and
the six hosted consumer jobs remain **NOT RUN / UNVERIFIED**.

## Output-route regression gate — follow-up

The installed-candidate smoke checks now explicitly cover output above 1024 bytes
with dense CJK/Bengali/astral Unicode and dense Latin1. They compare exact strings
and UTF-16 code-unit arrays against known key-ordered JSON, then check native batch
and selected raw output. A dense document containing escaped lone high/low
surrogates separated by ASCII, escaped ASCII, `1.00` and `-0` verifies lexical
preservation through the alternate native output route. A malformed second batch
item must preserve `Batch item 1` error context. ESM consumers additionally check
dense Unicode output. CI's build verification job also runs the independent
benchmark runner self-tests from `benches/reproduction/reproduction.test.cjs`.

These follow-up checks are pending execution while isolated optimization timings
run. The previous local candidate evidence above remains unchanged and does not
verify the subsequent Rust output-route optimization.
