# Release gate (publication not authorized)

- [x] Local release addon Windows x64 build/load and Rust unit tests.
- [x] CJS, ESM, strict TS and upstream differential scope.
- [x] Independent adversarial review and regressions fixed.
- [ ] Isolated full real-world performance evidence evaluated.
- [ ] Packed install from npm tarball with native loading.
- [ ] Dependency/license audit reviewed.
- [ ] Linux x64 Node22 and macOS ARM64 Node24 CI executed.
- [ ] Bundled three-platform tarball installed on every target.
- [ ] Runtime minimum/platform/glibc deployment claims verified.
- [ ] No known critical unresolved issues; documentation reconciled.
- [ ] Human approval before any npm publication, remote push or release.

CI builds three host-native artifacts and combines them into one root tarball.
This avoids unpublished optional platform packages during development. It costs
download size; consider napi CLI optional package layout before public release.
CI definition is not evidence the jobs have run. Native files are build outputs,
not committed binaries. Local tarballs carry only available host artifacts.
