# Development journal

## 2026-10-19 — bootstrap
Repository was empty except for Git metadata. Detected Windows 11 x64, Node
24.20.0, pnpm 12.10.1, rustc 1.98.1, Cargo 1.98.1 and Git 2.55.0.windows.5.
Cloned upstream read-only reference. No implementation or performance claims yet.
Harness provides terminal, patches, public web research and subagents; no extra
agent framework or project skill is needed for bootstrap.

## 2026-10-19 — working release addon and compatibility milestone
Pinned upstream SHA 49e230da2c84247b29ad4de02c9395793caefd15; primary-source
research and LOC audit completed. Installed locked local pnpm dependencies.
Release napi3 addon built with MSVC successfully. Rust RawValue engine preserves
scalar lexemes and UTF-16 key order; explicit native text APIs have bounded input.
Typed JS compatibility traversal, batches and explicit version cache implemented.
`pnpm build:js`, `pnpm test:types`, `pnpm test` pass (24 tests, including16 upstream
assertions,6000 JS/3000 native generated cases and11 independent adversarial tests).
`cargo test` passes3; `cargo clippy --all-targets --locked -- -D warnings` passes.
Initial failures: TS7 needed explicit Node types; ESM default type needed conditional
.d.mts declaration; event trace test compared distinct callback identities (fixed
observation encoding). Independent reviewer identified comparator capture/receiver,
Array iterator patch effects and ill-formed input replacement; all fixed/tested.
Native deep-input child processes tested up to100000 containers without crash.
Baseline raw data exists; acceptance comparisons await isolated full runs.

## 2026-10-19 — baseline diagnosis, scanner candidate and packed installation
Full baseline102 cells and9x100ms confirmations saved. Existing-text native API
beats parse+upstream on real lock/API workloads, but deep/Unicode regressed65–67%.
Source diagnosis: nested RawValue subtrees repeatedly scanned/deserialized; this
was an inference, not an allocation/call-stack profiler result. Replaced with one
serde validation and borrowed token tree. Added Rust stage profiler (safe memchr
scanner, no unsafe). Stage profile real API whole3.65ms, scan/sort/drop2.47ms,
validation0.567ms, prebuilt emission0.486ms; these are Rust-only and not additive
end-to-end npm claims. Full raw samples retained in benches/results stage text.
Independent reviewer added2000 lexical-token documents/malformed/depth regressions;
27 JS tests,3 Rust tests, strict types and clippy pass. `pnpm check` repeats pass.
Packed artifact installed offline with lifecycle scripts disabled, CJS/ESM/native
calls PASS. Created nonpublishing3-target CI and bundle candidate workflow; remote
jobs have NOT RUN. `.gitattributes` preserves exact fixture bytes across platforms.
Scanner optimization performance acceptance remains IN_PROGRESS pending new matrix.

## 2026-10-19 — optimization accepted; selective experiment and license/audit
Two9x100ms confirmations validate scanner gains on real lock/API and synthetic
deep/tiny/wide; Unicode remains66% slower than JS parse+upstream. Native batching
does NOT beat same-native loop (3.2%slower); retain convenience API withoutspeedclaim.
JS batch6.1%slower; cachehits skip work under explicit version contract. Allraw
evidence and competing library results retained in benches/REPORT.md.
Implemented raw selective extraction experimentalpointerAPI, wholeinputsyntax/depth
validation and explicit Unicode/duplicate restrictions. Independent3500 pathcases
pass. `pnpm check`: Rust5,Node33,strictCJS/ESMtypes PASS. Clippy PASS. New packed
artifact includesselect and38Rustcrate license texts; offlineCJS/ESM/native PASS.
License generator initiallyfound napi crates omitLICENSEtext: vendored exact
workspaceSHA license references and preserved attribution. pnpm audit zeroadvisories;
OSV38cratequeries noadvisories returned. Select performance stillpending.
