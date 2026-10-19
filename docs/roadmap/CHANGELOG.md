# Development changelog

## Unreleased
- Bootstrapped persistent project memory and read-only upstream reference.
- Implemented typed upstream compatibility serialization, ordered batch and
  explicit-version WeakMap cache with CJS/ESM exports.
- Added bounded Rust/napi3 JSON text sorting and batch; optimized repeated scans
  into once-validated borrowed token trees with exact scalar token preservation.
- Added selective raw JSON extraction with pointer subset and explicit limits.
- Independently verified25,740 generated cases,16 upstream assertions and adversarial
  events/Unicode/invalid/depth/cycle tests. Windows Node22.13/24.20 pass.
- Added reproducible real-world benchmarks, unfavorable results and raw evidence;
  no general Rust/batch speed claim. Full parsing/streaming/async/hash deferred.
- Added dependency/license inventories, bundled notices, offline npm/pnpm packed
  install checks and nonpublishing3-target CI. Linux/macOS release gates pending.

- Independently reproduced404 baseline cells and208 final before/after cells;
  rejected full-count Unicode routing, accepted bounded lossless UTF16 output.
- Final host-only tarball verified across npm/pnpm and Node22/24, including exact
  packed/installed/compiled addon identities. Combined target jobs still unverified.

- Fixed native batch indexed-read/iterator validation bypass and changing option
  getter limit bypass with single-read validated snapshots;9security regressions.
- Raised current JS verification to62groups on Windows Node22/24;5Rust and strictTS.
- Hardened schema2 candidate verifier with packed/installed/loaded hashes, genuine
  binary architecture checks and negative combined gate; pinned reviewed CI actions.
- Measured114 installed public-API/text/batch cells; compatible stringify shows no
  robust repeated >=10% gain. Per-API reports preserve unfavorable results.

- Positioned native existing-text sorting as measured performance API, with raw
  extraction benefits explicitly narrower and compatible default unchanged.
- Independently verified162native-text cells on original licensed sources plus
  normalized/small controls and direct-field extraction baselines; fullcorpora,
  samples/memory/source/native identities retained, no universal speed claim.
- Added12adversarial groups (74JS bothlocalruntimes), native-first shippedexamples
  and offlinefinalcandidate checks onNode22/24 withactualnativebyteidentity.
- Validated realWindows optional-package feasibility; keptcombinedrootdesign.
  DiagnosedNode22WindowsCLIstatidentityfailure, boundedtoolprobes andusedNode24
  buildtoolhosts while retaining22/24consumer jobs. Foreignexecutionunverified.
