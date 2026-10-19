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
