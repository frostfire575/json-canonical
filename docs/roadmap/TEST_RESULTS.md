# Test evidence

2026-10-19 Windows x64, Node 24.20.0, Rust 1.98.1: implementation tests NOT RUN
at bootstrap. Subsequent milestones append commands and actual results here.

## 2026-10-19 MVP (Windows11 x64, Node24.20.0, rustc1.98.1)
- `pnpm build:native`: PASS release build, napi3.14.2, CLI3.10.8/MSVC linker.
- `cargo test --locked`: PASS3 unit tests,0 doc tests (independently repeated).
- `cargo fmt --all --check`: PASS.
- `cargo clippy --all-targets --locked -- -D warnings`: PASS.
- `pnpm build:js`: PASS after adding explicit Node types for TS7.
- `pnpm test:types`: PASS CJS/ESM strict declarations after fixing ESM default type.
- `pnpm test`: PASS24 Node tests; includes all16 upstream assertions,6000 generated
  exact JS oracle cases,3000 native text cases and11 independent review tests.
- Reviewer `node --test tests/review.test.cjs`: PASS11 adversarial tests including
  comparator observable events, malformed input, array cycles, Unicode and deep
  native input (129,10000,100000 levels in child processes).
- Initial test trace false failure: independent callback objects were compared
  by identity; replaced log values with observable keys/type markers.
- Linux/macOS runtime tests: NOT RUN locally; hosted CI required.
- Packed installation/audit/full benchmarks: NOT RUN at this milestone.

Reproduce: `pnpm check`. Review details: INDEPENDENT_REVIEW.md; tests live in tests/.

## 2026-10-19 borrowed scanner and packaging candidate
- `pnpm check`: PASS release build, Rust3, Node27 (including14 independent review
  tests and2000 additional lexical documents), strict CJS/ESM consumer types.
- `node --test benches/harness.test.cjs`: PASS4, provenance checksums included.
- `cargo clippy --all-targets --locked -- -D warnings`: PASS after annotating
  test-only helper dead-code in the standalone stage benchmark harness.
- `cargo fmt --all --check`: PASS.
- `pnpm test:pack`: PASS offline install with scripts disabled; CJS/ESM/native
  text+batch calls. Tarball retained at
  `.pack-test/1792368342034-568/stable-json-rs-0.1.0.tgz` (ignored build artifact).
- `node scripts/setup-upstream.cjs`: PASS pin and read-only checkout verification.
- Independent scanner source/re-execution review: PASS, see INDEPENDENT_REVIEW.md.
- Cross-platform CI executions remain NOT RUN (no remote push authorized).

## 2026-10-19 selection and final dependency notices candidate
- `pnpm check`: PASS Rust5, Node33, strict types; JS includes14500 generated inputs
  across compatibility/native lexical/selection cases and16 upstream assertions.
- Independent selection review:3500 generated paths plus invalid siblings, array
  grammar, rawlexemes, Unicode and20000element array; see INDEPENDENT_REVIEW.md.
- `cargo clippy --all-targets --locked -- -D warnings`: PASS.
- `pnpm licenses:generate`: PASS38 packages after resolving missing napi crate
  LICENSEtext from pinned workspace commits; THIRD_PARTY_NOTICES.txt distributed.
- `pnpm audit:deps`: PASS pnpm zeroadvisories and OSV38lockedcratequeries nohits;
  inventory and raw responses in docs/audits/2026-10-19T00-06-38-891Z.
- `pnpm test:pack`: PASSselect plusCJS/ESM/native+thirdpartynotices;
  artifact `.pack-test/1792368713493-11320/stable-json-rs-0.1.0.tgz`.
- Selection performance acceptance NOTRUN at this milestone.
