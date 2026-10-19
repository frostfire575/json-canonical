# Development journal

## 2026-10-19 — independent continuation started
Read all recovery documents, architecture/compatibility/API/decisions and actual
implementation. Master was clean at113a8eb. Created perf/independent-reproduction.
Prior performance claims are historical evidence, pending fresh reproduction.
Independent agents own separate reproduction, expanded compatibility, and final
artifact CI review files. Timings will run serially, outside builds/tests.

## 2026-10-19 — historical result independently reproduced
Fresh pnpm check passed Rust5/JS33/types; rustfmt/clippy and five harness tests pass.
Independent runner imports neither old benchmark runner nor datasets module,
checks fixture/license hashes, actual loaded addon and release DLL SHA equality,
then times shuffled serial child processes. Two9x100ms runs: normalized lock native
3242/3428 vs parse+upstream1321/1341ops/s;1s warmup confirms3268/3318 vs1373/1358.
Original3377/1338 is plausible historical data, not a fixed reproducible constant.
Actual source lock143844 bytes differs from normalized93728-byte workload. Real API
and Unicode reproductions recorded too; Unicode deficit remains about66%.
Independent expanded tests pass43 JS groups (25740 generated cases overall),Rust5,
strict types, including8192 IEEE patterns,2048 arbitrary UTF16 cases,1000 shared
graphs,30k-record arrays and40k-key objects. No implementation defect found.
CI review fixed final combined tarball gap: pack once, checksum manifest, three
platforms x two Node versions install identical candidate with npm/pnpm and test
installed runtime/types. Host candidate Windows Node22/24 checks and actionlint
pass; missing-platform negative check correctly fails. Hosted jobs NOT RUN.
Private development-only encoding/stage probe is being measured; not exported or
shipped by the package. No optimization adopted before its profiling evidence.

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

## 2026-10-19 — final local verification and release boundary
Selective extraction confirmed twice: real lock `/name` +49% throughput, wide+56%,
but real API -25%,tiny/Unicode/deep substantially slower. Keep explicit niche API;
no automatic route or general extraction claim. Full parser/stream/async/hash
remain deferred with separate reasons in phases/advanced-evaluation.md.
Downloaded Node22.13.0 into project-local.tools after official checksum verification;
all33 JS tests and actual release addon pass at the declared Node minimum.
Both npm and pnpm offline tarball installs (scripts disabled) execute CJS/ESM/native
and compile packed CJS/ESM TypeScript consumers. TS7 executable discovery initially
hit export restrictions; fixed by reading its declared bin from exported manifest.
actionlint1.7.12 validates CI definition; macos-15 ARM64 selected from current
official runner documentation. No hosted job has executed.
Detached fresh worktree at37a969c independently clones/pins upstream, installs198
locked packages offline, rebuilds release addon, passes5 Rust/33 Node tests,
strict types,rustfmt,clippy,5 harness tests,unchanged regenerated notices and offline
npm packed installation. Fresh Git status clean. Worktree is retained ignored at
.verification/fresh for reproducibility. All local changes committed; stable branch
is merged locally to master. No remote push,publish or release performed.
Remaining production gate: Linux/macOS jobs and multi-platform artifact installation;
Docker client exists but daemon is unavailable, WSL has only docker-desktop. Rust
minimum1.88 has not been executed (local1.98.1 verified). No critical correctness
issue remains in reviewed scope. Production readiness is not claimed.

## 2026-10-19 expanded audit checkpoint
Independent baseline404 measured cells and seven harness tests now complete.
Real-world CLDR data/license retained; no production changes. Private release
probes isolate Unicode boundary costs and batch array/validation/copy categories.
Preallocation saves3 Rust reallocations/batch32 but does not improve real-record
throughput; reject as a stand-alone optimization. Cache pools establish conditional
usefulness at realistic hit ratios, with miss overhead disclosed. Detailed evidence:
REPRODUCTION_REVIEW.md,PROFILING_REVIEW.md and append-only raw JSON directories.
Next: independently validate adaptive output encoding through the public addon,
then separately simplify batch execution if its before/after evidence supports it.

## 2026-10-19 output optimization investigation
Rejected first public candidate: dense Unicode improved~76%,realCLDR~27%,but
sparse Unicode regressed~16% in both independent runs. Preserved all116 exact
cells and source/artifact hashes. Profiling isolated whole-output routing count
at14.7us for sparse text. Prefix-only screening still penalized a denseprefix +
ASCII tail. Revised candidate bounds sampling at1024bytes and retains original
encoding when any distributed sample is sparse. This is an empirical heuristic;
no semantic normalization is involved. Rebuild,5Rust48JS,TS and clippy pass;
independent renewed review/performance acceptance and package verification next.

## 2026-10-19 accepted output encoding milestone
Independent revised before/after208 measured cells, exact outputs allPASS:160
Node24main,8targeted batch confirmation and40Node22controls. RealCLDR Node24
+31–32%,Node22+34–35%; dense synthetic Unicode rises~4.5k to8.3–8.5kops/s but
still belowJS~13.3k. No confirmed repeat>10% control regression. A single short-
warmup batchsize1loop cell was~20% low; matched1s reruns original/candidate were
within~3%. No claim about its exactcause; unfavorablecell retained. All raw
samples/source/artifact/runtime metadata preserved. Independent review4PASS.

Final `pnpm check`: release build,5Rust49JS/strictTS PASS. WindowsNode22.13 full
49JS PASS; both benchmark harnesses12PASS; rustfmt/clippy,actionlint,verifier
syntax,license-generation unchanged PASS. No new production dependency or unsafe
Rust. Final npm/pnpm installed-candidate checks still active. README/publicdocs
now report original reproduction, updated output performance and remaininglosses.
Batch remains convenience; versioncache retained on measured hit-rate benefits.
