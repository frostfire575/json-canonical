# Native package distribution

The current packaging design bundles target-specific native files directly in one npm
tarball. Keep this design for the initial three-platform release: one archive can
be installed offline, with lifecycle scripts disabled and no Rust toolchain.
Windows x64 installations have executed successfully. A genuine combined archive
and its Linux x64/macOS ARM64 installations are **UNVERIFIED** until those actual
binaries have been built and tested. Host-only tarballs must fail the combined
verification gate.

## Bundled candidate

The maintained napi-rs loader tries these local files on the corresponding host:

| Target | Local file under `native/` | Optional-package fallback name |
|---|---|---|
| Windows x64 MSVC | `stable-json-rs.win32-x64-msvc.node` | `stable-json-rs-win32-x64-msvc` |
| Linux x64 GNU | `stable-json-rs.linux-x64-gnu.node` | `stable-json-rs-linux-x64-gnu` |
| macOS ARM64 | `stable-json-rs.darwin-arm64.node` | `stable-json-rs-darwin-arm64` |

The root package requires no optional dependencies when all three local files
are bundled. Its generated fallback branches do not mean the named packages exist
on the registry. No platform packages have been added to the root manifest.
Node-API8 bindings are built against a stable native interface; that does not
establish OS library compatibility. The prepared Linux runner is Ubuntu22.04
with glibc; Alpine/musl, older glibc systems, Intel macOS and Windows ARM64 are
outside the target set. Document runtime support at the environments actually
executed, without inferring it from a filename or architecture header.

The workflow builds on three actual hosts, gathers genuine native artifacts,
builds the wrapper and packs once. A schema2 manifest checks archive inventory,
runtime/declaration/license/documentation hashes and binary architecture. Six
OS/Node consumer jobs then install the same checksum-bound archive with both npm
and pnpm. Actual loaded binary identity must match the installed and packed
bytes. No consumer compiles native code. Header inspection is a structural check,
not execution on another OS. See the
[candidate review](roadmap/READINESS_CI_REVIEW.md) and
[distribution verification](roadmap/DISTRIBUTION_REVIEW_2.md).

## Split optional packages: feasible, not adopted

An alternative ships a small wrapper and one exact-version optional dependency
per supported target. napi-rs3.10.8's
[`create-npm-dirs`](https://napi.rs/docs/cli/create-npm-dirs) generates matching
names and `os`/`cpu` constraints; GNU Linux also receives `libc:["glibc"]`.
[`artifacts`](https://napi.rs/docs/cli/artifacts) assembles existing binaries into
the generated platform directories. Generation does not supply missing binaries.
Include the root license and all required native dependency notices in every
binary package; generation alone does not copy this project's notice inventory.

The local Windows prototype uses a real native platform tarball and a separate
wrapper without any `.node` file. npm and pnpm installed both offline with scripts
disabled; CJS, ESM, strict declarations and native API calls passed on Windows
Node22.13 and24.20. Metadata generation used Node24, as explained below. Disabling
optional dependencies leaves compatible `stringify` available; native calls
throw. An npm Linux metadata override skipped the Windows package; it did not
execute a Linux addon. The generated loader's version mismatch check is opt-in
through `NAPI_RS_ENFORCE_VERSION_CHECK=1`; normal releases therefore also need
exact dependency versions and identity verification. See the raw evidence and
limits in the distribution review.

The prototype uses an absolute local `file:` tarball spec for offline feasibility.
It is deliberately not a registry-ready manifest. A real split release would use
the three exact names above at the root's exact version, and requires control of
all package names, genuine tested binaries and approval to publish. Optional
dependencies can be omitted or unavailable, so lazy native loading and helpful
errors remain necessary. npm documents these rules in its
[`package.json` reference](https://docs.npmjs.com/cli/configuring-npm/package-json/).

Split packages reduce downloads of irrelevant binaries but add multiple artifact,
version, registry and lockfile states. This project has only three targets and
has not measured a distribution-size problem. Prefer the single combined
candidate until real cross-platform execution passes and a concrete need justifies
the added release coordination. No split release has been prepared for publishing.

## Build tools and consumer runtimes

Use Node24 for development/CI native tooling. Windows Node22.13's filesystem
observations disagreed on the same file's BigInt device identity: `fstat` reported
the actual device while `lstat` reported zero. The installed napi CLI's ownership
checks consequently rejected its own filesystem lock repeatedly. A bounded
reproducer timed out; CLI `--help` still worked. This is an observed Windows
toolchain limitation, not a native API failure or evidence of the same Linux bug.
CI builds now use Node24; final installed consumers still exercise Node22/24.
See the [diagnosis](roadmap/DISTRIBUTION_REVIEW_2.md#node22-toolchain-diagnosis).

## Steps before approving a release

1. Execute every three-host build and same-archive consumer job. Preserve raw
   results, SHA256, compiler versions and runtime environment.
2. Inspect native OS dependencies and state tested minimum environments. Do not
   claim broad Linux/glibc or macOS compatibility from one runner.
3. Confirm license notices, package imports, declaration resolution, missing-native
   errors and identical loaded bytes from the final artifact on every target.
4. If split distribution is later selected, separately pack and install every
   platform package, verify exact optional dependency specs and test omitted,
   missing, mismatched and unsupported-target behavior. Verify dependency
   publication before the root package; publication is not atomic.
5. Obtain explicit approval before any push, publication or release. Never run
   [`napi pre-publish`](https://napi.rs/docs/cli/pre-publish) as a packaging test:
   by default it can publish platform packages and create GitHub assets. This
   repository's current nonpublishing CI never invokes it.
