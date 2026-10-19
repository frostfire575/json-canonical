# Independent native-text security and API review 3

Review executed 2026-10-19, starting from Git
`f7b1f73a0057e582f73068b5500dbb9ad82eafa3`. The lead owns integration and
runtime fixes; this reviewer owns only this report and
`tests/native-text-security-review.test.cjs`. No runtime code was changed.

## Result

**12 new adversarial test groups PASS on EACH Windows Node24.20.0 and
Node22.13.0, with zero failures/skips. No new reproducible runtime defect was
found in this review.** These are actual public wrapper calls through the
release native addon, not a mock or Rust-only test. The result is limited to
this tested scope; it is not a security certification or foreign-platform
runtime verification.

The loaded addon file `native/stable-json-rs.win32-x64-msvc.node` and compiled
release `target/x86_64-pc-windows-msvc/release/stable_json_rs.dll` both have
SHA256 `96ba87bcc9a76f9c2cce21cede7ef74ea10e69b147a69b5435536f1ce81c5f86`.
This matches the previous release-build evidence. No rebuild was necessary for
the test-only change. Compilation, Rust tests and the full integration suite
are the lead's separate milestone checks; they are not counted as executed by
this review.

## Inspection and tests

Read AGENTS, handoff, tasks, progress, decisions, architecture, compatibility,
API and security documentation; inspected `engine.rs`, `tree.rs`,
`selection.rs`, `output.rs`, `lib.rs`, `js/index.ts`, and existing native,
selection, output and readiness regression tests. The structural scanner
remains behind whole-document serde validation, depth is bounded, no unsafe
Rust was introduced, and error paths return errors rather than partial output.

The added tests independently cover:

- Exact raw scalar spelling, including numbers outside JavaScript's finite or
  exact range, negative zero, exponent/decimal forms, escaped lone surrogate
  values and whitespace stripping around the selected root token.
- JavaScript UTF-16 object-key ordering, combining characters without Unicode
  normalization, controls, slash/tilde/backslash/quote keys, supplementary
  scalars and prototype-like names. The ordering oracle uses plain JS string
  comparison, not the Rust implementation or a parser/stringifier roundtrip.
- Decoded duplicate detection, including slash escapes and surrogate pairs;
  nested sorting failures; batch error indices; selection's last-duplicate
  behavior and raw selected duplicate retention.
- Lone surrogate key rejection for sorting, rejection when decoding a
  traversed object, and intentional retention in unvisited/root raw subtrees.
- Malformed syntax, control characters, invalid escapes, trailing input,
  comments and errors in unselected branches. Missing or early selection does
  not bypass whole-document validation.
- Single-pass JSON Pointer decoding, empty keys, escaped slashes/tilde,
  embedded controls and Unicode, invalid pointer escapes, scalar traversal,
  array index grammar, integer overflow and object keys resembling indices.
- Exact UTF-8 byte/depth boundaries across all three native APIs; invalid
  numeric option types/values; 64KiB pointer boundaries and 128 segments.
- Propagation of caller getter exceptions, and rejection of invalid public
  arguments before option callbacks execute.
- **2,400 additional seeded lexical documents**, with exact sorting and
  **19,200 exact field/array selections**, plus missing-path checks. Numbers
  remain raw tokens, so the expected output does not silently lose precision.
- An isolated process processes **1,000 deterministic malformed fragments**
  (JSON.parse is used only to classify validity), and excessive nesting at
  129/1,024/65,536 levels. Both sorting and selection reject invalid input;
  extreme-depth single/batch/selection calls return InvalidArg without a
  crash, signal or timeout.

These are permanent review/regression coverage. No failing-before case was
discovered, so there is no new runtime fix or invented regression resolution.
The prior batch snapshot and limit-getter regressions remain in the separate
`readiness-security.test.cjs` suite.

## Executed evidence

Windows x64, local source wrappers and genuine release addon, commands from
the repository root:

```powershell
node --test tests/native-text-security-review.test.cjs
.tools/node-v22.13.0-win-x64/node.exe --test tests/native-text-security-review.test.cjs
Get-FileHash native/stable-json-rs.win32-x64-msvc.node
Get-FileHash target/x86_64-pc-windows-msvc/release/stable_json_rs.dll
```

Both test commands exited 0. Node24 output: `tests 12`, `pass 12`, `fail 0`,
`skipped 0`, duration377.8819ms. Node22 output: `tests 12`, `pass 12`, `fail 0`,
`skipped 0`, duration355.2145ms. Durations are test-run observations and must
not be used as API performance measurements. The independent processes ran
concurrently, with no benchmark conclusions drawn from them.

## Remaining boundaries

The native APIs synchronously scan untrusted input and allocate/copy at the
Node-API boundary before Rust can apply byte limits. A per-document byte cap
is not a process memory budget. Raw text scalar preservation intentionally
differs from JSON.parse plus JavaScript number/string normalization; keys and
selection traversal have the documented decoded-Unicode restrictions. Do not
market this as RFC8785 or full RFC6901 compliance.

Options getters execute caller code. The tested single-read semantics prevent
the previously discovered time-of-check/time-of-use bypasses; they do not
sandbox callbacks or hostile monkeypatching of global intrinsics. No new
global mutation test or broader promise was added. Dependency advisory/license
audits, packaged consumer execution and unavailable Linux/macOS runtime checks
remain separate evidence owned by the lead, not inferred from this review.
