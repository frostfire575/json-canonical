# Test results

## 2026-10-24, rewrite/v2

Environment: Windows 11 Pro x64, i7-12700K, Node 24.22.1 (V8 13.6.233.17),
rustc 1.98.1, pnpm 12.10.1, TypeScript 7.0.2.

| Command | Result |
|---|---|
| `cargo fmt --all --check` | pass |
| `cargo clippy --workspace --all-targets --locked -- -D warnings` (pedantic enabled in workspace lints) | pass |
| `cargo test --workspace --locked` | 13 passed |
| `pnpm build` (release addon + TypeScript) | pass |
| `pnpm test` (Node 24.22.1 and Node 22.13.0) | 22 passed on each |
| `pnpm test:types` (strict, NodeNext, `.mts` and `.cts` consumers, one `@ts-expect-error`) | pass |
| `pnpm test:pack` (packed tarball, npm install `--offline --ignore-scripts`, CJS and ESM smoke), consumer on Node 24.22.1 and on Node 22.13.0 via `CONSUMER_NODE` | pass on each, 12 files in tarball |

Seeded coverage inside those runs:

- Rust: 20,000 generated documents through every mode with serde_json as the value
  oracle, sort idempotence and canonical fixed-point checks; 30,000 mutated
  documents where validity must agree with serde_json (lone surrogate escapes and
  huge exponents cross-checked independently, since serde_json rejects valid
  RFC 8259 there); 200,000 random words for the SWAR string scanner against a
  byte-by-byte check; all ordered pairs of 13 boundary strings for UTF-16 order.
- JavaScript, with V8 as the oracle: 20,000 documents with random key order,
  whitespace, escapes and number spellings, canonicalized from strings and
  Buffers; 1,000 documents over 1 KiB to exercise the `encodeInto` path;
  1,000,000 doubles in up to seven spellings each against `String(n)`; 10,000
  documents for sortKeys and minify; 10,000 JSON Pointer lookups against
  `JSON.parse` navigation; 30,000 mutations where `isValid` must agree with
  `JSON.parse`.
- Every power of two and both bit neighbours (about 6,100 doubles) in three spellings
  against `String(n)`, plus strict mode on the exact spelling.
- Regression tests for each independent-review finding: option-getter and
  argument reentrancy, strictNumbers semantics, linear time for 1000 unsorted
  levels around a 4 MB value, bare CR line counting.
- RFC 8785 section 3.2.4 example and Appendix B number vectors.

## CI

https://github.com/frostfire575/stable-json-rs/actions/runs/40101134172: Windows x64, Linux x64 and macOS ARM64, each on Node 22.13.0 and 24.22.1. Every job builds with Node 24.22.1, runs rustfmt, clippy and the Rust tests, then switches to the matrix Node for the JS tests, type tests and `test:pack`. All six passed and uploaded a native artifact per target.

Two earlier runs failed for reasons outside the engine. Node 24.20 and 24.21 have a V8 `JSON.parse` defect that broke the test oracle (REGRESSIONS.md), and @napi-rs/cli 3.10.8 times out on its own filesystem lock on Windows under Node 22.13, so builds now use Node 24.

## Not run

- Benchmarks on Linux and macOS.
