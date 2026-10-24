# Development journal

The 0.1 journal is in history at commit 39ef120. This one starts with the rewrite.

## 2026-10-24: v2 rewrite on `rewrite/v2`

Removed the 0.1 implementation, tests, scripts and evidence from this branch (all
remain in history at 39ef120). Built a Cargo workspace with a zero-dependency engine crate
and a napi-rs binding crate. The engine parses and writes in one pass, sorts
objects by moving member spans, and compares keys in UTF-16 order on UTF-8 bytes.

The JS differential test found that Rust's shortest float formatting can pick a
non-closest last digit; fixed by re-rounding at the shortest length. The first
full benchmark showed float-heavy canonicalization at 0.8x and string-input
validation of large documents below `JSON.parse`. A fast path for numbers of at
most 15 significant digits and three boundary changes (encodeInto for strings of
1 KiB and up, a U+FFFD byte scan instead of `isWellFormed`, copied Buffer output
under 64 KiB) moved the large-string cells to parity or better. Float-heavy input
is still 0.88x from a string.

One benchmark run was invalid (background, unpinned, baselines 2.5x slow) and is
recorded as such; the reference run is pinned to the performance cores.

Verified on Windows x64 with Node 24.22.1 and Node 22.13.0: Rust tests, clippy
pedantic, JS tests, strict type tests, and installing the packed tarball into a
fresh consumer. CI later passed on Windows x64, Linux x64 and macOS ARM64 with Node 22.13.0 and 24.22.1.

An independent review then found five defects: a shared-buffer race through option
getters, wrong digits at 46 powers of two, misdocumented `strictNumbers`,
O(size x depth) sorting of deep unsorted objects, and bare CR line counting. All
are fixed with regression tests. The power-of-two fix first checked every long
number and cut float canonicalization to 0.28x; limiting it to exact powers of two
restored 0.80x. Final numbers are medians of three pinned runs.

## 2026-10-24: Ryu number formatter (V2-FLOAT)

Replaced Rust's `{:e}` and the closest-digit correction with a port of Ryu's
`d2d`, plus a script that generates its power-of-five tables. A new Rust test
checks 2,000,000 random doubles for round trip and minimal length. The 22 JS tests
pass on Node 24.22.1 and 22.13.0, and a one-off sweep of 19,991,770 doubles (a
fifth subnormal, a fifth next to powers of two) found no difference from
`String(Number)` on either. Canonicalizing 200,000 random doubles went from 0.80x
to 1.60x of the JavaScript pipeline over three pinned runs.

## 2026-10-24: Command line (V2-CLI)

Added `stable-json`, a bin built from `js/cli.ts` on top of the public API with
`node:util` `parseArgs`, so the package still has no runtime dependencies. It
covers canonicalize, sort-keys, minify, validate, select, hash and equal, reads a
file or standard input, and exits 0, 1 (rejected JSON, unequal values, no match)
or 2 (usage or file error). Seven new tests run the compiled CLI as a child
process and compare its output with the API. `test:pack` now runs the bin shim
npm installs. All 29 JS tests pass on Node 24.22.1 and 22.13.0.

## 2026-10-24: Benchmarks for equal and canonicalHash (V2-BENCH-API)

`benches/run.cjs` now times `equal` against `JSON.parse` with `util.isDeepStrictEqual`
and with `canonicalizeValue` on both sides, and `canonicalHash` (string and Buffer
input) against SHA-256 over `safe-stable-stringify` and over `canonicalizeValue`.
Over three pinned runs `canonicalHash` is 1.51x to 4.60x of the fastest
JavaScript pipeline. `equal` is 0.49x to 1.22x of `isDeepStrictEqual`, because it
canonicalizes both documents in full; that is recorded as a known gap.

## 2026-10-24: Release workflow (V2-PUBLISH-CI)

Publishing from this machine would have shipped only the Windows addon, so publishing moved to CI. `.github/workflows/release.yml` calls `ci.yml` for the full matrix, takes the addons those jobs built and tested, checks that the tag matches the package version and that the tarball holds all three addons, and publishes with provenance. A manual run stops at `npm publish --dry-run`; one passed. Tag pushes no longer start a separate CI run.

## 2026-10-24: Benchmarks against canonical-json and json-stable-stringify (V2-BENCH-PEERS)

Before picking a package name with "fast" in it, the benchmark gained the two packages users are most likely to compare against. `canonical-json` is faster than every earlier baseline (1.17x to 1.62x of `canonicalizeValue`), which cut the reported canonicalize lead from 1.6-4.2x to 1.37-2.67x and `canonicalHash` from 1.5-4.6x to 1.4-3.4x. The engine still wins every canonicalize and hash cell. README and docs/performance.md now quote the new figures.

## 2026-10-24: Linux ARM64 (V2-ARM64)

CI now builds and tests `aarch64-unknown-linux-gnu` on GitHub's native `ubuntu-22.04-arm` runner, so the addon is tested on the hardware it ships for, with no emulation. The release workflow expects four addons. Covered: AWS Graviton, Docker on Apple Silicon, 64-bit Raspberry Pi OS. Still without a prebuilt addon: musl, Intel macOS, Windows ARM.

## 2026-10-24: Package renamed to json-canonical (V2-NAME)

Three independent reviews (search ranking, branding, a critic) all rejected `fast-canonical-json`: it reads as a fork of `canonical-json`, and "fast" is false for object input. `json-canonical` matches the queries people type ("canonical json", "json canonicalize") and npm ranks exact name matches first. The CLI installs as `jcanon` and `json-canonical`. The README gained a section for people coming from `canonical-json` or `json-stable-stringify`, including when to stay with them. The addon files keep the `stable-json-rs.*.node` names, which users never see.

## 2026-10-24: json-canonical 0.2.0 published (V2-RELEASE)

The tag `v0.2.0` ran the release workflow, which published `json-canonical@0.2.0` with a provenance attestation using a seven-day granular token. Next: the owner sets up trusted publishing on npmjs.com and deletes the token, then release-please (V2-RELEASE-PLEASE).

## 2026-10-24: release-please and trusted publishing (V2-RELEASE-PLEASE)

release.yml runs release-please on every push to main and publishes from the same run when the release PR is merged, authenticating through the npm trusted publisher instead of a token. `json-canonical@0.2.1` was the first release made that way. The npm token and the `NPM_TOKEN` secret are no longer used.

## 2026-10-24: Docs and graphics (V2-DOCS-GRAPHICS)

The README now opens like claude-code-statusline: a hero image, a view counter, links and badges. It was rewritten around a quick start, a table of what canonical means, and the API, CLI and error tables. `scripts/gen-docs-graphics.py` draws five hand-drawn SVGs into `docs/images` with the Python standard library: the hero (real output from the built package), the data flow, the number paths, and two benchmark charts read from runs 16-11, 16-16 and 16-21. The chart values match the tables in docs/performance.md. architecture.md was rewritten around the two diagrams, and performance.md gained a summary with both charts; its tables are unchanged.
