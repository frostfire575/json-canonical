# Release gate (publication not authorized)

- [x] Local release addon Windows x64 build/load and Rust unit tests.
- [x] CJS, ESM, strict TS and upstream differential scope.
- [x] Independent adversarial review and regressions fixed.
- [x] Isolated full real-world performance evidence evaluated.
- [x] Packed install from npm tarball with native loading (pnpm and npm).
- [x] Dependency/license audit reviewed; third-party notices preserved.
- [ ] Hosted Windows x64, Linux x64 and macOS ARM64 jobs executed, including
  identical combined-candidate consumption on BOTH Node22.13 and24 per target.
- [ ] Bundled three-platform tarball installed on every target.
- [ ] Runtime minimum/platform/glibc deployment claims verified.
- [x] No known critical unresolved issue in independently reviewed public scope.
- [x] Windows Node22.13.0 minimum and Node24.20.0 runtime tests.
- [x] CI definition checked with actionlint1.7.12; hosted jobs NOT RUN.
- [x] Prior baseline fresh Git worktree rebuild (37a969c); current fixture bytes verified.
- [x] Source757bc26 security snapshots:5Rust/74JS on each local Windows runtime;
  strict TS,9independent security groups, no unresolved review finding.
- [x] Sourcefc006f9 final documentation tarball: offline npm/pnpm CJS/ESM/types/native
  on Windows22/24; schema2 identities and explicit missing-combined rejection.
- [x] Final runtime/package/license bytes equal114-cell benchmark candidate;
  compatible APIs show no robust repeated >=10% gain, native text separate.
- [x] Current reviewed action references pinned; schema2 negative/integrity tests.
- [x] Independent packed/installed/compiled addon and wrapper byte identities verified.
- [ ] Rust1.88 minimum toolchain execution (local Rust1.98.1 tested).
- [ ] Human approval before any npm publication, remote push or release.

CI builds three host-native artifacts and combines them into one root tarball.
This avoids unpublished optional platform packages during development. It costs
download size; consider napi CLI optional package layout before public release.
CI definition is not evidence the jobs have run. Native files are build outputs,
not committed binaries. Local tarballs carry only available host artifacts.

- [x] Native text positioning:162exact-checked cells, originalinputforms/direct
  extraction baselines and memory caveats; no universal stringify/extractionclaim.
- [x] Final positioned artifact91982c... installednpm/pnpm22/24 withnativeidentity,
  shippedCJS/ESMexamples and strictTSapplication verified.
- [x] RealWindowsoptionaldistributionprototype on22/24consumers usingNode24tools;
  no unavailableoptionalDependencies added to root.
- [x] DocumentedNode22WindowsCLIgenerationfailure; boundedprobes/allNode24buildhosts.
