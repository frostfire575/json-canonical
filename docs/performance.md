# Performance

## Method

`pnpm bench` (`benches/run.cjs`) times the public API end to end, including
argument checks, the Node-API crossing and creating the returned string or
Buffer. For each fixture and operation it first runs every implementation once
and checks the output: `exact` means byte-identical to the reference, `same
value` means equal after `JSON.parse` (used where formats legitimately differ,
such as a baseline that normalizes numbers). Each cell then gets 500 ms of
warmup and nine samples of at least 100 ms; the table shows the median and the
median absolute deviation. Cells run in shuffled order. Raw samples are written
to `benches/results/<timestamp>.json` and never overwritten.

Baselines are what a Node developer would write without this package:
`JSON.parse` followed by `canonicalizeValue` (the same algorithm as the
`canonicalize` npm package), `safe-stable-stringify`, `fast-json-stable-stringify`
at commit 49e230d, `JSON.stringify`, and plain property access. "previous native"
is the 0.1 addon from `master`, kept at `target/baseline/old.node`.

Fixtures: four files recorded with source URLs, commits and hashes in
`benches/data/manifest.json` (TypeScript's package.json and package-lock.json,
the fast-json-stable-stringify benchmark fixture, JSONPlaceholder data), plus
three seeded synthetic documents: 40,000 records indented with Unicode text,
the same records already sorted and minified, and 200,000 random doubles.

## Environment

Windows 11 Pro x64, Intel i7-12700K, Node 24.22.1 (V8 13.6.233.17), rustc
1.98.1, release profile with fat LTO and one codegen unit. Each run was pinned to
the performance cores (affinity 0xFFFF) at high priority. An unpinned run in the
background (`2026-10-24T04-41-06-112Z.json`) had baselines 2.5 times slower than
an identical earlier run and is kept only as a record of that failure. Even
pinned, single runs varied by up to about 30% on small fixtures, so the table
reports three runs. Linux and macOS have not been measured.

## Results

Final code, runs `2026-10-24T05-00-56-883Z`, `05-03-37-786Z` and `05-06-06-944Z`.
Each cell is the median ratio over the three runs against the fastest JavaScript
baseline for that operation, with the range in parentheses. Inputs and outputs
are strings unless the column says Buffer. The last column is the 0.1 addon
against the same JavaScript baseline, for comparison with the sortKeys column.
All 294 cells produced the checked output; 62 had a within-run MAD above 5%.

| fixture | bytes | canonicalize | sortKeys | minify | validate | select | canonicalize, Buffer in/out | sortKeys, 0.1 addon |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| jsonplaceholder-data | 1378184 | 2.24x (2.22-3.81) | 1.59x (1.28-1.69) | 1.81x (1.47-1.97) | 1.49x (1.46-1.59) | 1.83x (1.46-1.99) | 2.83x (2.72-4.08) | 1.18x (1.06-1.63) |
| synthetic-already-sorted | 5904178 | 3.81x (3.23-4.88) | 3.75x (3.52-5.36) | 1.79x (1.41-2.82) | 1.35x (1.26-1.36) | 1.32x (1.28-1.38) | 6.94x (6.33-7.48) | 2.06x (1.60-2.65) |
| synthetic-floats | 4052927 | 0.80x (0.72-0.80) | 4.19x (4.13-4.59) | 3.32x (3.21-3.37) | 1.69x (1.58-1.69) | 1.68x (1.52-1.89) | 0.80x (0.76-0.80) | 2.24x (1.98-2.37) |
| synthetic-records-8mb | 8184179 | 2.73x (2.59-2.80) | 2.11x (2.10-2.16) | 1.73x (1.59-1.90) | 1.16x (1.16-1.42) | 1.19x (1.18-1.24) | 3.46x (2.91-3.69) | 1.46x (1.01-1.99) |
| typescript-package | 1838 | 2.57x (2.18-3.41) | 1.76x (1.62-1.86) | 1.80x (1.74-1.91) | 1.24x (1.07-1.38) | 0.91x (0.83-1.15) | 2.58x (2.16-3.69) | 1.68x (1.62-1.72) |
| typescript-package-lock | 143844 | 3.45x (3.06-3.74) | 2.51x (2.46-2.63) | 2.69x (2.27-2.79) | 2.06x (1.85-2.11) | 2.06x (1.81-3.29) | 3.75x (3.74-3.86) | 1.58x (1.54-1.63) |
| upstream-test | 3965 | 3.22x (2.50-3.25) | 2.22x (2.14-2.50) | 2.02x (1.94-3.14) | 1.58x (1.47-2.11) | 1.23x (1.15-1.30) | 3.03x (2.92-3.05) | 1.75x (1.61-2.00) |

Every per-cell median, MAD and raw sample is in the JSON files.

## What the numbers say

The engine wins most where JavaScript has to build objects it then throws away.
Canonicalization runs 2.2 to 3.8 times faster than parse-and-serialize from a
string, and up to 6.9 times faster with Buffer input and output. Sorting with
preserved tokens runs 1.6 to 4.2 times faster, which is also faster than the 0.1
addon on every fixture.

It loses in two places. Canonicalizing 200,000 random 17-digit doubles runs at
0.80x, because each such number takes two passes through Rust's float formatter
(see decisions D6). `select` on a 1.8 KB document is 0.91x: at that size the call
overhead is most of the cost and V8's `JSON.parse` is very fast. Validating the
8 MB indented string is only 1.16x, because UTF-16 to UTF-8 transcoding takes
about as long as the parse; as a Buffer the same document validates in about half
the time `JSON.parse` takes on the string.

## Boundary changes, before and after

Same machine, same harness, run `2026-10-24T04-33-18-153Z` (before) against the
pinned run `2026-10-24T04-44-04-703Z` (after). Before: strings crossed through Node-API's own conversion and
every Buffer output was an external Buffer. The before run was in the foreground but not pinned, so treat differences under about 10% as noise.

| Cell | Before ops/s | After ops/s |
|---|---:|---:|
| synthetic-records-8mb validate, string | 41 | 45 |
| synthetic-records-8mb select, string | 40 | 54 |
| upstream-test canonicalize, Buffer output | 58,965 | 110,644 |
