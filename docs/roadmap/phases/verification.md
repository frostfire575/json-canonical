# Phase verification map

| Phase | Concrete evidence | Remaining boundary |
|---|---|---|
| 0 bootstrap | AGENTS, research, pinned checkout, environment output, local commit | repeat setup script on a fresh clone |
| 1 baseline | benches/data manifest, harness tests and raw initial results | isolated confirmation currently active |
| 2 MVP | release binding and Rust3/Node smoke | only Windows executed |
| 3 compatibility |16 upstream assertions,6000 generated cases,review11 cases | exhaustive JS programs unproven |
| 4 optimization | baseline shows deep/Unicode regressions | borrowed scan alternative not yet built |
| 5 batch/cache | behavior tests and benchmark matrix | final conclusions pending |
| 6 advanced | primary-source research | independent evaluation tasks in TASKS |
| 7 readiness | CI/pack check implementation | execution, audit and remote targets pending |

TASKS.md is the authoritative status list; evidence documents record commands.
