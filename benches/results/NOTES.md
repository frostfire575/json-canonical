# Run annotations

- `2026-10-18T23-55-47-261Z-23840.json`: initial upstream/native-JSON
  contextual baseline before optional competitor installation. Native API and
  competitors were not available. No native performance claim can be derived.
  This early format records a shell-style command; on PowerShell set its listed
  environment values separately and run `node benches/run.cjs`.
- `2026-10-18T23-57-08-658Z-27592.json`: competitor baseline. Compilation
  began concurrently in the lead session, so this is exploratory, potentially
  CPU-contaminated evidence. Some late samples show high variability (batch
  upstream MAD 15.8%, backend fast-stable-stringify MAD 20.5%). Do not use these
  cells to justify optimizations. A later isolated release-addon matrix is
  required. All reported cells first passed exact output validation for their
  particular fixture; this is not a general compatibility claim for competitors.

Both raw reports are retained without modification. Later report formats also
record exact benchmark environment overrides, dependency versions, source hashes
and native artifact hashes for stronger reproduction.
