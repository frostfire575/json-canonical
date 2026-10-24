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
