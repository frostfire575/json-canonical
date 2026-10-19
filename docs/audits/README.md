# Dependency/license checks

Executed2026-10-19 on Windows x64 with `pnpm audit:deps`.
Latest artifacts: `2026-10-19T09-53-11-521Z/` (raw responses preserved).
The prior `2026-10-19T00-06-38-891Z/` and `2026-10-19T01-21-02-497Z/`
inventories remain historical evidence.

`pnpm audit --json`: exit0, zero reported advisories at all severities.
`pnpm licenses list --json`: exit0, dependency license inventory retained.
`cargo metadata --locked`: inventory of all38 registry crates and licenses.
Each crate name/version was queried against the public OSV crates.io ecosystem
API;38 responses, no vulnerabilities returned, no pagination tokens. This is an
advisory database check, not a source-code audit or future security guarantee.
No global cargo-audit installation required. [OSV batch API](https://google.github.io/osv.dev/post-v1-querybatch/).

Reviewed license inventory: Rust alternatives are MIT/Apache-2.0/ISC/Unlicense,
with Unicode-3.0 data licensing on unicode-ident; npm groups are MIT, Apache-2.0,
ISC,0BSD and PSF-2.0. No unknown or copyleft license expression was found in this
inventory. This is engineering inventory review, not a legal opinion.

Project/upstream MIT notices are retained in LICENSE/NOTICE; dataset notices and
provenance are retained beside benches/data fixtures. Rust license expressions
and npm inventory must be reviewed again before release after dependency updates.
The npm package has no JavaScript runtime dependencies. Build/test dependencies
include Tape's deprecated glob/inflight transitive packages; current audit reports
no known vulnerability. They are not included as runtime dependencies.
