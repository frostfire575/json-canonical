# Local split-distribution feasibility check

Run from a built repository on Windows x64:

```powershell
pnpm exec node scripts/distribution-review/run.cjs
```

Requires installed local development tools and the genuine release addon under
`native/`. It creates a new ignored `.verification/distribution-*` directory,
generates target metadata using the installed napi CLI, and packs **only the
actual Windows binary** into an optional package. A wrapper tar has no binary
and uses a sandbox-local absolute `file:` optional dependency. npm/pnpm offline
install with scripts disabled; CJS/ESM, native identities and strict declarations
are checked. Missing optional dependency and opt-in mismatch cases are preserved.
The npm Linux override tests metadata filtering on Windows, never Linux execution.

The script does not publish, build native code, edit the root package manifest,
pack foreign metadata-only directories or delete old evidence. It is not a
registry-ready release tool. Each run preserves exact commands/results and
tar/native hashes in `report.json`; reviewed raw reports are stored in `evidence/`.
Existing prototype reports must not be overwritten. See
[`docs/distribution.md`](../../docs/distribution.md) for the production decision.

Every child command has a30s timeout and256KiB output limit. Failure logs are
preserved separately with hashes and bounded excerpts in the report. For actual
Node22 consumers with the verified Node24 metadata-generation host:

```powershell
$env:NAPI_METADATA_NODE=(Get-Command node).Source # Node24 executable
pnpm exec ./.tools/node-v22.13.0-win-x64/node.exe scripts/distribution-review/run.cjs
Remove-Item Env:NAPI_METADATA_NODE
```

Only napi metadata generation uses the override. npm, TypeScript and all consumer
processes use the script's actual Node runtime; the pnpm executable has its own
runtime. Report fields distinguish these scopes. Node22 Windows native-tool
metadata generation failed in an observed filesystem identity loop; it is not
counted as passed. Run the bounded, nonbuilding diagnosis with
`node scripts/distribution-review/diagnose-cli.cjs`; its each child is capped at5s.
