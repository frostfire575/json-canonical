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
