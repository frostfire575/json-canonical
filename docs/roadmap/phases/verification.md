# Phase verification map

| Phase | Concrete evidence | Remaining boundary |
|---|---|---|
| 0 bootstrap | AGENTS, pinned upstream audit/research; fresh checkout setup passes | none locally |
| 1 baseline | Real fixture manifests including CLDR,12 harness tests,404 independently reproduced cells | single-machine measurements |
| 2 MVP | Release binding, five Rust tests; Windows Node22/24 native execution | Linux/macOS unverified |
| 3 compatibility |16 upstream assertions,25,740 seeded cases,49 JS groups and independent event/encoding reviews | exhaustive JS programs unproven |
| 4 optimization | Borrowed scanner and bounded output encoding;208 revised before/after cells on Windows Node22/24; failed candidate retained | dense synthetic Unicode still slower than JS |
| 5 batch/cache | Behavior tests; native and JS loops measured; explicit-version hits/misses | no batching speed benefit demonstrated |
| 6 advanced | Selection implemented/3500 generated paths/two measurements; other features deferred with rationale | narrow metadata extraction gains only |
| 7 readiness |49 JS/five Rust tests,strict TS,clippy,offline npm/pnpm same-tarball installs on22/24,byte identities,license/audit and actionlint pass | Hosted platform jobs and combined artifact installation NOT RUN |

TASKS.md is the authoritative status list; evidence documents record commands.
