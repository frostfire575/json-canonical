# Independent installed JSON-text verification

This experiment imports the actual installed public package through a bare
CommonJS specifier. It does not import another benchmark runner or time a private
Rust engine. `stringifyJson` includes wrapper validation, limits, Node-API input
conversion, sorting, output conversion and return. `selectJson` additionally
includes public pointer parsing. Both are synchronous.

Use an existing **schema2** packed candidate with a completed isolated npm
installation. Do not time while builds, tests, audits or other agents are active
on the CPU. Windows PowerShell reproduction:

```powershell
$env:NATIVE_TEXT_CANDIDATE='.verification/readiness-final-01'
node --test benches/native-text-verification/run.test.cjs
node benches/native-text-verification/run.cjs
# Substitute the new raw report path printed by the runner:
node benches/native-text-verification/verify-evidence.cjs <raw-report.json>
node benches/native-text-verification/summarize.cjs <raw-report.json>
```

The old candidate path is local and ignored. To recreate it, follow
`scripts/verify-ci-candidate.cjs` and the roadmap test reports, using a NEW
candidate directory. Never overwrite historical archives or manifests. The
runner requires an explicit candidate, and checks its archive SHA256, schema,
every manifest-bound packed and installed file, actual local addon loaded and
Windows release DLL equality. A changed runtime requires new correctness tests
and a new timing run; newer documentation can be tied to the measured runtime
by byte equality. Foreign binary headers do not demonstrate runtime support.

All five source files and their licenses are rechecked against the pinned
manifests in `../data/manifest.json` and
`../profiling/data/cldr-manifest.json`. The main matrix covers their **original
downloaded text**, including whitespace. Three normalized-text controls isolate
effects of whitespace/input size for lock/API/CLDR. A derived real API-user record
is a small-input control. Normalization is outside timing and explicitly labeled;
it is never silently substituted for the original source.

Each of nine input variants has four timed operations:

- Existing text to sorted text: public `stringifyJson` vs `JSON.parse` followed by
  the pinned upstream serializer.
- Existing text to selected scalar JSON text: public `selectJson` vs `JSON.parse`,
  matching pointer lookup and `JSON.stringify` of the result.

The `select-js` baseline decodes/interprets the generic pointer on each call.
The additional `select-direct-js` control uses explicit literal selectors chosen
before timing. Run it paired with native selection (three fresh passes):

```powershell
$env:NATIVE_TEXT_METHODS='select-native,select-direct-js'
node benches/native-text-verification/run.cjs
Remove-Item Env:NATIVE_TEXT_METHODS
```

Do not describe the generic baseline as an optimized direct field lookup.

All chosen original and normalized inputs have **exact identical output** for
the corresponding comparison. Selection paths choose existing scalar fields;
this does not establish performance for full subtrees or all path depths.
Numeric spellings, escaped strings, duplicates, lone-surrogate keys, invalid
JSON and raw-subtree whitespace have separate untimed correctness controls.
Those controls preserve differences instead of pretending the APIs are generally
equivalent. No RFC8785 claim; text sorting preserves scalar token spelling.

Default execution is three independently shuffled passes, each cell in a fresh
process, one-second warmup, nine samples of at least100ms. Each returned string's
length and middle UTF16 code unit are consumed. Exact full string equality is
checked before and after timing; hashes are recorded. The raw report points to a
gzip-compressed UTF8 JSON artifact retaining every exact input, expected sorted
output and expected selected output. Dataset reads/generation, modules, expected
results, archive verification and hashes are outside timed sections. JS baseline
parsing stays inside its timed function; native boundary costs stay inside native
calls. No worker parallelism.

Each raw report preserves samples, median/MAD, latency, input/output throughput,
CPU usage, RSS/heap snapshots, process maxRSS, machine/Node/V8/toolchain/commit,
dirty status, source and package identities, exact command environment and frozen
runner bytes. Median/MAD is not a confidence interval. RSS and maxRSS include
setup, archive validation, fixture objects, modules and warmup; they are **not**
serializer-only peaks or allocation counts. No lower-memory claim follows from
them. Startup is excluded; no event-loop responsiveness benefit is claimed.

`NATIVE_TEXT_DATASETS` and `NATIVE_TEXT_METHODS` allow comma-separated filters;
`NATIVE_TEXT_RUNS` must be at least2 for timing. The warmup/sample variables cannot
weaken minimum acceptance settings. `NATIVE_TEXT_CHECK_ONLY=1` runs exact checks
without timing. New runs create unique report/corpus files and frozen source
snapshots. Partial completed cells and failures are retained if a run fails.
