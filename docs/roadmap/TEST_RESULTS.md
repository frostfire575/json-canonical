# Test results

## 2026-10-24, rewrite/v2

Environment: Windows 11 Pro x64, i7-12700K, Node 24.22.1 (V8 13.6.233.17),
rustc 1.98.1, pnpm 12.10.1, TypeScript 7.0.2.

| Command | Result |
|---|---|
| `cargo fmt --all --check` | pass |
| `cargo clippy --workspace --all-targets --locked -- -D warnings` (pedantic enabled in workspace lints) | pass |
| `cargo test --workspace --locked` | 14 passed (13 before the Ryu port) |
| `pnpm build` (release addon + TypeScript) | pass |
| `pnpm test` (Node 24.22.1 and Node 22.13.0) | 29 passed on each (22 before the CLI) |
| `pnpm test:types` (strict, NodeNext, `.mts` and `.cts` consumers, one `@ts-expect-error`) | pass |
| `pnpm test:pack` (packed tarball, npm install `--offline --ignore-scripts`, CJS and ESM smoke, `stable-json` bin shim), consumer on Node 24.22.1 and on Node 22.13.0 via `CONSUMER_NODE` | pass on each, 14 files in tarball |

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
- After the Ryu port: 2,000,000 random doubles in Rust (round trip, and the same
  digit count as `{:e}`), and a one-off sweep of 19,991,770 doubles against
  `String(n)` on Node 24.22.1 and 22.13.0 with no mismatch. The sweep script is
  not committed.

## CI

https://github.com/frostfire575/stable-json-rs/actions/runs/40101134172: Windows x64, Linux x64 and macOS ARM64, each on Node 22.13.0 and 24.22.1. Every job builds with Node 24.22.1, runs rustfmt, clippy and the Rust tests, then switches to the matrix Node for the JS tests, type tests and `test:pack`. All six passed and uploaded a native artifact per target.

Two earlier runs failed for reasons outside the engine. Node 24.20 and 24.21 have a V8 `JSON.parse` defect that broke the test oracle (REGRESSIONS.md), and @napi-rs/cli 3.10.8 times out on its own filesystem lock on Windows under Node 22.13, so builds now use Node 24.

https://github.com/frostfire575/stable-json-rs/actions/runs/40104034037: the same six jobs on `050470c` (Ryu formatter) all passed, so the V8 number tests ran against the new formatter on Linux x64 and macOS ARM64 too.

## Not run

- Benchmarks on Linux and macOS.

CLI commit 0062229, run https://github.com/frostfire575/stable-json-rs/actions/runs/40105582760: all six jobs passed, including the 7 CLI tests and the `stable-json` bin shim check in `test:pack` on Windows x64, Linux x64 and macOS ARM64 with Node 22.13.0 and 24.22.1.

Release workflow dry run, commit after c3f01cb, https://github.com/frostfire575/stable-json-rs/actions/runs/40108866513: the six CI jobs passed through `workflow_call`, then the publish job downloaded the three addons, passed `pnpm test`, `test:pack` and the three-addon tarball check, and ran `npm publish --provenance --access public --dry-run`. The tarball listed 15 files with `stable-json-rs.darwin-arm64.node`, `linux-x64-gnu.node` and `win32-x64-msvc.node`. The dry run ended with `404 Not Found - GET https://registry.npmjs.org/stable-json-rs`, which only means the name is not on npm yet.

Competitor benchmark, runs `2026-10-24T16-11-41-552Z`, `16-16-26-099Z` and `16-21-13-048Z` (Node 24.22.1, pinned): all 546 cells produced the checked output, including exact canonical bytes from `canonical-json` and `json-stable-stringify` on all seven fixtures. A one-sample check run made before them was deleted because it was not evidence.

Linux ARM64, commit 2737e78, release dry run https://github.com/frostfire575/stable-json-rs/actions/runs/40111746583: eight verify jobs passed, including `ubuntu-22.04-arm` (linux/arm64) on Node 22.13.0 and 24.22.1, which ran the full Rust and JS suites and `test:pack` natively. The publish job found four addons, the tarball listed 17 files with `stable-json-rs.linux-arm64-gnu.node` (668 kB), and `npm publish --dry-run` completed.

Release v0.2.0, tag on b647384, https://github.com/frostfire575/json-canonical/actions/runs/40113692205: eight verify jobs and the publish job passed, and `npm publish --provenance` published `json-canonical@0.2.0` (17 files, 1.0 MB packed). npm first created its own placeholder version `0.0.0-stage`; `latest` points at 0.2.0. A fresh `npm install --prefer-online json-canonical@0.2.0` on Windows x64 canonicalized and hashed correctly, `jcanon sort-keys` kept `12345678901234567890` exact, and `npm audit signatures` reported a verified SLSA provenance attestation. The first install attempt failed with ETARGET because of a stale registry cache.

Release v0.2.1 through release-please, merge commit 774bbb4, https://github.com/frostfire575/json-canonical/actions/runs/40115691880: release-please created the tag and GitHub release, eight verify jobs and the publish job passed, and `npm publish --provenance` ran with no token. The registry records `_npmUser` as GitHub Actions with `trustedPublisher.id` `github`, `latest` is 0.2.1, and the version carries an SLSA provenance v1 attestation (sigstore log index 3441224085). The registry took about a minute to list the version.
