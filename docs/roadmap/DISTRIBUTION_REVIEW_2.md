# Independent distribution review — 2026-10-19

Read AGENTS, current handoff, roadmap status, architecture/decisions, actual
package manifest, generated loader, candidate verifier and workflow. Starting
verified Git reference: `f7b1f73a0057e582f73068b5500dbb9ad82eafa3`.
The lead concurrently changed package description/examples metadata; no runtime
code was changed for this experiment. This reviewer owns only distribution
documentation and the isolated reproducible prototype. No root optional
dependencies, foreign binary placeholders, workflow edits or remote operations.

## Conclusion

The current one-tarball design is feasible and the simpler first-release path.
It does not need optional dependencies: its generated loader first tries bundled
host-specific files. The actual combined candidate remains unverified because
only a genuine Windows addon exists locally. Split optional distribution also
works on the tested Windows host, but no measured distribution need justifies
changing the root manifest or release design now.

## Executed Windows prototype

Command: `pnpm exec node scripts/distribution-review/run.cjs`.
Source and short instructions: [`scripts/distribution-review`](../../scripts/distribution-review/).
The script makes a unique `.verification/distribution-<timestamp>-<pid>` folder;
no existing candidate is overwritten. All install caches, pnpm store and child
temporary paths are inside this folder. It invokes installed napi-rs3.10.8's
`create-npm-dirs --cwd <sandbox>/generated`, never `pre-publish`. Generated Linux
and macOS directories contain **metadata only** and are never packed or loaded.

Environment: Windows x64, Node24.20.0, npm11.19.0, pnpm12.10.1. Parent source
reference, full Node/V8 versions, script/loader identities, generated manifests,
exact commands and outputs, tar manifests/hashes and loaded paths are in the
[final raw report](../../scripts/distribution-review/evidence/2026-10-19-node24-pass.json).
The final command completed with exit0 and seven PASS consumer/control entries:

| Check | npm | pnpm |
|---|---|---|
| Offline, no lifecycle scripts, wrapper + actual Windows optional tar | PASS | PASS |
| Installed CJS + ESM and all three native APIs | PASS | PASS |
| Strict `.cts` + `.mts`, `skipLibCheck:false` | PASS | PASS |
| Actual loaded optional binary SHA equals source release addon | PASS | PASS |
| Omit optional dependencies: compatibility works, native call throws | PASS | PASS |
| Fresh process rejects installed metadata0.1.1 with opt-in version guard | PASS | PASS |
| `--os=linux --cpu=x64`: Windows optional dependency skipped | PASS | NOT RUN |

The final row is npm selection-metadata verification on Windows, **not Linux
runtime execution**. The opt-in mismatch case changes only a throwaway installed
manifest then restores it. The tested guard is not enabled for consumers by
default; exact version dependency specs are still required in a real split release.

Both root-wrapper prototypes have no `.node` in their actual packed inventory.
The optional platform package contains the real 412672-byte Windows binary plus
LICENSE, NOTICE and THIRD_PARTY_NOTICES. Actual loaded SHA256:
`96ba87bcc9a76f9c2cce21cede7ef74ea10e69b147a69b5435536f1ce81c5f86`.
Final prototype tar identities:

| Artifact | Packed bytes | SHA256 |
|---|---:|---|
| Windows platform tar | 204855 | `11d6e5618e1563dbd418af0b26318b9cacd1801c141ee180c1698af23ad9354f` |
| Wrapper-only tar | 22019 | `abb380098694e62e21bdee211dd9d8065951fc189fbd7471b6747568ee7fa40d` |

These are **prototype** artifacts, not current final release candidates. The
wrapper includes an absolute local `file:` optional dependency to make an offline
two-tar installation possible; it is not suitable for registry publication.
Do not compare this minimized wrapper's size with full documentation candidates
as evidence of a universal size improvement. Foreign binary sizes are unknown.

First prototype run exit1 is retained in the
[initial report](../../scripts/distribution-review/evidence/2026-10-19-initial-reviewer-fail.json).
The reviewer incorrectly required a transitive optional manifest from the
application. npm hoisting allowed this; pnpm's isolated layout did not. Native
loading had already succeeded. Corrected the verification to use `createRequire`
from the wrapper's actual resolution path. This is a test-author error, not a
runtime package defect. The corrected five-control run and final seven-control
run both passed; earlier raw reports remain in ignored unique candidate folders.

`node --check scripts/distribution-review/run.cjs`: PASS, exit0.
No Rust build or runtime source change was made for packaging feasibility.
The initial review did not execute Node22. The follow-up below subsequently
verified actual Node22 split-package consumers with a separate Node24 tool host.

## Generated package metadata and release feasibility

| Triple | Generated package | Filters |
|---|---|---|
| x86_64-pc-windows-msvc | `stable-json-rs-win32-x64-msvc@0.1.0` | `os:["win32"]`, `cpu:["x64"]` |
| x86_64-unknown-linux-gnu | `stable-json-rs-linux-x64-gnu@0.1.0` | `os:["linux"]`, `cpu:["x64"]`, `libc:["glibc"]` |
| aarch64-apple-darwin | `stable-json-rs-darwin-arm64@0.1.0` | `os:["darwin"]`, `cpu:["arm64"]` |

All generated names match the actual loader's `require(...)` branches. A split
registry release would put all three exact-version names in optionalDependencies,
remove bundled `.node` files only deliberately, ensure names are controlled and
publish genuine tested platform artifacts before the root. No registry ownership,
availability, authentication or real resolution was tested. Current root has no
such dependency entries, which is correct for a bundled candidate.

Verified maintained primary documentation on2026-10-19:

- [napi create-npm-dirs](https://napi.rs/docs/cli/create-npm-dirs): generates
  configured-target manifests; keep generated directories as CI output.
- [napi artifacts](https://napi.rs/docs/cli/artifacts): assembles already-built
  target files. Tool generation is not cross-compilation or foreign testing.
- [napi pre-publish](https://napi.rs/docs/cli/pre-publish): has registry/GitHub side
  effects, updates exact-version optional entries, and is not a safe default
  packaging preview. Not invoked. A registry release is not atomic.
- [npm manifest reference](https://docs.npmjs.com/cli/configuring-npm/package-json/):
  optional entries may be absent and `os`/`cpu`/`libc` constrain installation.

Installed CLI `napi --help`, `create-npm-dirs --help`, `artifacts --help` and actual
`src/api/create-npm-dirs.ts` were inspected. Exact flags above are executed CLI
syntax, not proposed or fabricated options. Explicit notice copying is needed
because the generated manifest does not include this project's third-party
notice inventory by itself.

## Three-platform workflow review

`.tools/actionlint/actionlint.exe .github/workflows/ci.yml`: PASS, exit0.
The initial review needed no workflow change. The later reproduced Windows
toolchain issue justified using Node24 for every build/tool host; see below.
Reopened pinned official action metadata:
[checkout](https://github.com/actions/checkout/blob/3d3c42e5aac5ba805825da76410c181273ba90b1/action.yml),
[setup-node](https://github.com/actions/setup-node/blob/949feb2413d6458794dcd2491c4babbbce0c15c1/action.yml),
[pnpm setup](https://github.com/pnpm/action-setup/blob/0977fd99725f1db4007ccb2928dbb4e90d06cc86/action.yml),
[Rust toolchain](https://github.com/dtolnay/rust-toolchain/blob/683b588c487a69d01f6c6ddf40f036ff682cc2c8/action.yml),
[upload](https://github.com/actions/upload-artifact/blob/cf430e030ddbb5b0abf93d22962f4752f3646cd9/action.yml)
and [download](https://github.com/actions/download-artifact/blob/9000827ccba6bdab643e8b6fd33ac0654aef8333/action.yml).
Used inputs exist: archived multi-file uploads, explicit hidden candidate paths,
fail-on-digest-mismatch downloads, credentials disabled, caching disabled,
explicit pnpm version and stable Rust. JavaScript actions use Node24; this is
separate from the package's Node22/24 test matrix.

Current official [runner reference](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)
lists Windowslatest/Ubuntu22.04 as x64 and macos15 as ARM64; workflow host
assertions guard these assumptions. All pinned action implementation metadata
was readable and consistent with current workflow use. Pinning actions does not
pin hosted images, stable Rust or all external downloads.

Remaining gates: actual Linux/macOS native build/load, same combined-tar
installation across all three hosts, and native OS dependency/minimum-runtime
inspection. **NOT RUN/UNVERIFIED.** Static lint, generated metadata, npm `--os`
selection and PE/ELF/Mach-O header checks cannot satisfy them. No remote was
pushed, no hosted workflow dispatched, no package published and no release made.

## Node22 toolchain diagnosis

The lead independently reran the original Windows Node24 prototype: seven
controls PASS in `.verification/distribution-2026-10-19T10-04-17-762Z-25104`.
Attempting to run the entire prototype with Node22.13 then hung during napi
`create-npm-dirs`, before package metadata was generated. The lead terminated the
specific owned child after more than two minutes. Its original4.9MB warning
report remains ignored in
`.verification/distribution-2026-10-19T10-04-54-207Z-31936/report.json`;
it is not counted as a passing test or committed as an oversized report.

An independent bounded reproduction is saved in
[`diagnose-cli.cjs`](../../scripts/distribution-review/diagnose-cli.cjs), invoked
with `node scripts/distribution-review/diagnose-cli.cjs`. The
[compact raw diagnostic](../../scripts/distribution-review/evidence/2026-10-19-node22-cli-diagnostic.json)
preserves exact binaries/commands, generated-file checks,5s timeouts, raw output
hashes and excerpts. Results:

| Operation on this Windows host | Node24.20 | Node22.13 |
|---|---|---|
| napi CLI `--help` | PASS | PASS |
| napi `create-npm-dirs` with fresh single-target metadata | PASS | ETIMEDOUT after5s; metadata NOT generated |
| Plain `fs.fstatSync` vs `fs.lstatSync`, BigInt identities | Same dev/ino | **Different dev**, same ino |

The plain filesystem probe has no napi imports. For the same open Node22 file,
`fstatSync(fd,{bigint:true}).dev` returned`4033986277`, while
`lstatSync(path,{bigint:true}).dev` returned`0` before and after renaming.
Node24 reported`4033986277` consistently. The installed CLI's
`src/utils/misc.ts:statIdentitiesMatch` requires equal BigInt `dev` and `ino` for
ownership. Its reconciliation logic consequently treated its own reserved path
as replaced, preserving candidate/retired files and retrying. The preserved
warnings identify this exact ownership check. This explains the observed
Windows Node22 tooling failure; no runtime source or guard was weakened.

It does not establish a Linux Node22 defect. The lead changed the CI native-build
tool hosts to Node24 and retained Node22/24 installed-consumer jobs. Actual
foreign execution remains UNVERIFIED. Build tooling documentation now states
Node24 separately from the package's installed minimum Node22.13.

The prototype now accepts an explicit metadata-only Node host override and bounds
all child commands to30s/256KiB. Failures keep separate raw logs with hashes and
bounded report excerpts; the outer error is capped at2KiB rather than embedding
an unlimited execFileSync stack. The bound is diagnostic containment, not a
performance or package runtime limit. No package API changed.

Executed actual Node22 consumer verification:

```powershell
$env:NAPI_METADATA_NODE=(Get-Command node).Source # actual Node24.20 executable
pnpm exec ./.tools/node-v22.13.0-win-x64/node.exe scripts/distribution-review/run.cjs
Remove-Item Env:NAPI_METADATA_NODE
```

PASS, exit0; seven controls, same real native binary. napi metadata ran on
Node24.20; npm10.9.2, strict declaration compilation and actual CJS/ESM/native
consumer processes ran on Node22.13. The pnpm12.10.1 executable has its own host
runtime; its installed API verification explicitly used Node22.13. Missing
optional/mismatch controls and npm metadata filtering also passed. Exact report:
[`2026-10-19-node22-runtime-pass.json`](../../scripts/distribution-review/evidence/2026-10-19-node22-runtime-pass.json).
This verifies consumers, **not Node22 napi metadata generation**.

The bounded final script was also rerun normally on Node24.20: seven controls
PASS, exit0. Both script syntax checks PASS. Current report:
[`2026-10-19-node24-bounded-pass.json`](../../scripts/distribution-review/evidence/2026-10-19-node24-bounded-pass.json).
No new benchmark timing or native compilation was performed during this diagnosis.
