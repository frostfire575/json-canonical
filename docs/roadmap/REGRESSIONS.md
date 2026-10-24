# Regressions and defects found

| Date | Found by | Defect | Fix | Guard |
|---|---|---|---|---|
| 2026-10-24 | JS differential test, 20k seeded documents | Canonical output printed `113017829008754.13`; V8 prints `.12`. Rust's `{:e}` returns the shortest length but not always the closest digits. | Re-round correctly to the shortest length for 16 to 17 digit values and subnormals (`number::shortest`) | `closest_shortest_digits` Rust test; 1M-double JS test |
| 2026-10-24 | Benchmark, 4 to 8 MB documents | String input spent longer in Node-API conversion than in parsing (validate 0.90x of `JSON.parse` on 8 MB) | `encodeInto` a reused buffer from 1 KiB up; U+FFFD byte scan replaces `isWellFormed` on large input | BENCHMARK_HISTORY.md before/after; large-document differential test |
| 2026-10-24 | Benchmark, 4 KB document | `{ output: 'buffer' }` ran at half the speed of string output because of external Buffer creation and finalization | Copy outputs under 64 KiB | BENCHMARK_HISTORY.md before/after |
| 2026-10-24 | Rust mutation test | Test oracle disagreed with serde_json on lone surrogate escapes and huge exponents; both are valid RFC 8259 that serde_json rejects | Test cross-checks those cases with an independent escape walker instead of skipping them | `seeded_mutations_agree_with_serde_on_validity` |
| 2026-10-24 | Independent review | An option getter (or a reentrant argument conversion) could call the API and overwrite the shared encode buffer before the native call read it, so `canonicalize(a, opts)` returned `b` | Read every option before encoding; `equal` converts its second argument first | `review: option getters...` JS test |
| 2026-10-24 | Independent review | Re-rounding at the shortest length picked a decimal outside the rounding interval at powers of two (46 of 2,098), e.g. 2^-24 printed ...062e-8, which parses to another double | At exact powers of two, try the rounded value and its two neighbours and keep the one that round-trips | Every power of two and both neighbours against `String(n)`; Rust vectors |
| 2026-10-24 | Same fix, benchmark | The first version of that fix checked every 16-17 digit number and dropped float canonicalization to 0.28x | Check only exact powers of two; other intervals are symmetric | BENCHMARK_HISTORY.md 04-57 vs 05-00 |
| 2026-10-24 | Independent review | `strictNumbers` docs promised "exactly representable", but the check rejects changed printed values (2^60 written in full is rejected, `0.1` accepted) | Behaviour kept, since it is what signing needs; docs and message corrected | `review: strictNumbers...` JS test |
| 2026-10-24 | Independent review | Sorting moved bytes at every unsorted level, O(size x depth): 1 s for a 4 MB value under 1000 levels | Unsorted objects record patches; one final pass copies each byte once | `review: deep unsorted nesting stays linear` |
| 2026-10-24 | Independent review | A bare `\r` did not start a new line in error positions (the review's expected column was also off by one; the test uses column 1) | `\n`, `\r\n` and `\r` all end a line | Rust `errors_and_limits` |

## Known gaps

- Float-heavy canonicalization is about 0.8x of the JavaScript pipeline (TASKS V2-FLOAT).
- `select` on a 1.8 KB string is about 0.9x of `JSON.parse` plus property access.
- Linux and macOS have not run (TASKS V2-CI).
