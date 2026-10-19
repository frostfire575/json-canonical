# Production candidate and CI review — 2026-10-19

Independent review resumed from `a406f93`. Read AGENTS, handoff, task/progress,
architecture/decisions and actual workflow/verifier/package/loader sources.
Current local host is Windows x64. No remote job, publication or release was run.

## Verified design and changes

The workflow builds actual native addons on Windows x64, Linux x64 and macOS
ARM64. Each build host asserts its Node platform/architecture. The bundle job
downloads all three artifacts, builds JS and packs exactly once. Six consumer
jobs install the same downloaded checksum-bound tarball on Node22.13/24, using
both npm and pnpm offline with lifecycle scripts disabled. Consumer jobs do not
compile Rust or rebuild wrappers. Permissions remain contents-read only;
checkout credentials are no longer persisted in any job.

Confirmed runner labels against the current official
[GitHub hosted-runner reference](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)
on 2026-10-19: `windows-latest` and `ubuntu-22.04` select x64;
`macos-15` selects ARM64. Explicit host assertions guard label drift. Confirmed
[upload-artifact documentation](https://github.com/actions/upload-artifact)
requires explicit hidden-file inclusion for `.verification` artifact paths;
the workflow uploads only the candidate/manifest/evidence allowlist.

Previously the combined gate only checked nonempty native filenames. Manifest
schema2 now records SHA-256 and size from actual packed runtime files, including
wrappers, declarations, native loader, licenses/notices, README and performance
documentation. The manifest step requires all three target binaries before
upload and inspects their PE x64, ELF x86_64 or Mach-O ARM64 headers. This rejects
renaming a Windows addon as another target. A header check is structural evidence,
not foreign runtime verification.

The verifier rejects invalid candidate filenames, unsafe/duplicate archive paths,
unsupported native artifacts, unknown manifest runtime paths and changed packed
bytes. Manifest creation uses exclusive creation to preserve prior evidence.
Prepared copies and installed runtime files must match packed hashes. An isolated
CJS process records the actual loaded `.node` path and hash from `require.cache`;
both must match the installed local host artifact. Reports include the command,
verifier hash, Node component versions, TypeScript version and loaded-native
identity. These checks do not depend on runtime files from the source checkout.

Installed CJS and ESM consumers exercise compatibility serialization, native
sorting/batch/selection, dense Unicode output, lexical token preservation and
errors. Packed `.cts` and `.mts` consumers compile with strict checking and
`skipLibCheck:false`, including expected-error checks that verify object input,
numeric batch items, missing cache versions and numeric paths are rejected by
the advertised declarations.

Installed CJS checks additionally exercise the batch validation snapshot fix:
a custom empty iterator cannot conceal malformed UTF16 input; a stateful indexed
getter is read exactly once; an options getter that mutates the original array
cannot replace validated text before the native call.
An installed `stringifyJson` call also verifies that a changing depth getter is
read once and its validated restrictive limit reaches Rust, rather than a second
read silently replacing it with an absent limit. Final packed execution of these
new regression cases subsequently PASS in all four lead-executed Windows
npm/pnpm x Node22/24 readiness-benchmark-01 reports (TEST_RESULTS.md).
Final documentation candidate verification is a separate gate.

## Executed evidence

Windows x64, Node24.20.0, initial unchanged release addon available:

| Command | Status | Evidence |
|---|---|---|
| `node --test tests/candidate-verifier.test.cjs` | PASS | 4 groups, 0 failures; actual host packed-file identity and negative missing-platform gate; ~22s |
| `.\.tools\actionlint\actionlint.exe .github/workflows/ci.yml` | PASS | exit0 |
| `node --check scripts/verify-ci-candidate.cjs` | PASS | exit0 |

Native architecture tests use small **in-memory unit-test vectors**, never packed
or loaded foreign addons. The packed fixture contains only the actual built host
binary; its missing-platform failure is expected. Its unique temporary directory
is removed after assertions. No combined package success is inferred from it.

The lead owns final current-source packed installations, full regression runs,
evidence persistence and integration. The fresh final candidate must use schema2;
old manifests/raw reports are historical evidence and must not be overwritten.

## Unverified gates

- Actual Linux x64 and macOS ARM64 addon compilation/loading: **NOT RUN** locally.
- A real combined tarball containing all three actual target builds: **NOT RUN**.
- Hosted native artifact transfer, six final-candidate jobs and identical-SHA
  installation across all three targets: **NOT RUN**.
- Configuration lint and header inspection do not satisfy these runtime gates.
- Hosted execution of the newly pinned Node24 action versions remains **NOT RUN**.

No fabricated foreign binary or placeholder is used to claim combined support.
Run the prepared workflow only after remote execution is authorized; do not push,
publish or release as part of local readiness work.

## Follow-up: verified immutable action references

Resolved public maintainer refs with `git ls-remote` on 2026-10-19, then fetched
each exact commit's `action.yml` and README from `raw.githubusercontent.com`.
All JavaScript actions below declare `runs.using: node24`; Rust uses composite
Bash steps. The documented Node24 minimum Actions Runner is2.327.1; this workflow
uses hosted runners, with actual execution still pending. Product tests continue
to target Node22.13/24 independently of the action host runtime.

| Maintainer repository / inspected ref | Pinned commit | Reviewed metadata |
|---|---|---|
| actions/checkout v7 | `3d3c42e5aac5ba805825da76410c181273ba90b1` | [action](https://github.com/actions/checkout/blob/3d3c42e5aac5ba805825da76410c181273ba90b1/action.yml): persist-credentials input retained; ordinary pull_request/push/dispatch triggers unaffected by new unsafe-checkout protection |
| actions/setup-node v7 | `949feb2413d6458794dcd2491c4babbbce0c15c1` | [action](https://github.com/actions/setup-node/blob/949feb2413d6458794dcd2491c4babbbce0c15c1/action.yml): node-version retained; auto cache explicitly disabled; no registry/auth input used |
| actions/upload-artifact v7 | `cf430e030ddbb5b0abf93d22962f4752f3646cd9` | [action](https://github.com/actions/upload-artifact/blob/cf430e030ddbb5b0abf93d22962f4752f3646cd9/action.yml): name/path/hidden-file inputs retained, archive:true explicitly preserves zipped multi-file artifact behavior |
| actions/download-artifact v8 | `9000827ccba6bdab643e8b6fd33ac0654aef8333` | [action](https://github.com/actions/download-artifact/blob/9000827ccba6bdab643e8b6fd33ac0654aef8333/action.yml): name/pattern/path/merge-multiple retained; digest-mismatch:error explicitly fails corrupted downloads |
| pnpm/action-setup v6.0.10 | `0977fd99725f1db4007ccb2928dbb4e90d06cc86` | [action](https://github.com/pnpm/action-setup/blob/0977fd99725f1db4007ccb2928dbb4e90d06cc86/action.yml): unchanged explicit pnpm12.10.1; no automatic install/cache requested |
| dtolnay/rust-toolchain master | `683b588c487a69d01f6c6ddf40f036ff682cc2c8` | [action](https://github.com/dtolnay/rust-toolchain/blob/683b588c487a69d01f6c6ddf40f036ff682cc2c8/action.yml): explicit toolchain:stable and existing components inputs |

The pnpm v6 ref is an annotated tag: pinned its verified **peeled commit**, rather
than its tag object. The maintainer recommends pnpm/setup for newer pnpm; retained
the same action/input model with the verified Node24 implementation to avoid an
additional installer/runtime migration in this readiness change. Its hosted
pnpm12 installation remains subject to the same unexecuted platform gate.

The Rust maintainer explicitly requires full-SHA pins to come from master history
to avoid garbage collection of generated toolchain-branch commits. Therefore
resolved master and supplied toolchain:stable explicitly, instead of pinning the
generated stable branch. Rust stable compiler selection and hosted images still
advance; immutable action code does not make the entire build bit reproducible.

`actionlint1.7.12` and workflow whitespace checks pass after these substitutions.
This replaces the initial mutable-ref hardening opportunity with pinned reviewed
action code. It is static/configuration evidence only, not an executed hosted job.
