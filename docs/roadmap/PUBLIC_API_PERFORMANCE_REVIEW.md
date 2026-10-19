# Installed public API performance review — 2026-10-19

**No robust >=10% JavaScript-compatible public stringify gain is established.**
No workload passed that threshold across both shuffled runs. The compatible
APIs stay in JS and never load native code. Faster existing-text measurements
must never advertise a universal object stringify speedup.

## Artifact, execution and reproducibility

Windows11 Pro x64, i7-12700K,20 logical CPUs,32GiB; Node24.20.0 /
V8 13.6.233.17-node.53, Rust1.98.1. No Node flags/NODE_OPTIONS. Shared workstation.
Source `757bc263d0ce9c6774da5fd68e3f7b9935e152ef`; installed candidate
`.verification/readiness-benchmark-01`, tar SHA256
`66e82b265c2e3dfb3edfe7220c1b2c63a0506e453612d7c8884f95f7e7667017`.
Loaded release native SHA256
`96ba87bcc9a76f9c2cce21cede7ef74ea10e69b147a69b5435536f1ce81c5f86`.
Pinned upstream `49e230da2c84247b29ad4de02c9395793caefd15`.

```powershell
$env:PUBLIC_API_CANDIDATE='.verification/readiness-benchmark-01'
node --test benches/public-api/run.test.cjs
node benches/public-api/run.cjs
$env:PUBLIC_API_BATCH='1'
node benches/public-api/run.cjs
Remove-Item Env:PUBLIC_API_BATCH
$env:PUBLIC_API_TEXT='1'
node benches/public-api/run.cjs
```

Initial4 selftest groups passed. After selection coverage5 passed. Final guard
hardening adds a sixth test rejecting implicit timing candidates: final6PASS.
Includes42 object,3 ordered batch and12 text/selection exact prechecks. All114
measured cells separately pass exact outputs before/after timing. No production
source was edited by this review.

Append-only evidence in `benches/public-api/results/`, with matching summaries:

| Group | Raw JSON | Cells | Frozen runner SHA256 |
|---|---|---:|---|
| Objects | `2026-10-19T01-32-18-492Z-7352.json` |84| `d523fb03f7e9896c14af72f0059f09722476c58d3644e3878cdba5255b5a32c3` |
| Batch | `2026-10-19T01-35-24-055Z-14936.json` |6| same |
| Text/selection | `2026-10-19T01-36-28-139Z-19788.json` |24| `9885b0be7432f3b78bed44c2c9a138ce92f3458eda895f0f78268ac9855a89bd` |

Both immutable sources remain. Every raw cell records source/license hashes,
actual installed/packed wrapper bytes, loaded addon/release DLL equality, samples,
CPU/memory observations and package identity. Old batch control tar SHA256 is
`644220b6316efacad54546c124e1e1260efc18679a54ff9eef724f6c96232fff`.

## Method and limits

Independent runner imports no older harness. Real project fixtures/subsets cover
TypeScript config/lock, JSONPlaceholder backing data/comments/user, upstream's
API-shaped mock fixture and CLDR Bengali localization. The upstream fixture is
mock data, not a captured response. Sources/licences are verified.

Same already-materialized JS object for each object method. Loading, parsing,
record selection, imports/oracle generation stay outside timing. Object roundtrip
repeats JSON.stringify inside every timed call. Existing-text groups precompute
normalized JSON, distinct from original formatted source. Default options/plain
data only; callback/comparator timing is not covered.

CJS resolves the installed root export. ESM uses a distinct generated consumer
manifest and a junction to the actual installation, imports the bare package name
and asserts Node's resolved export URL. Aliases share one function. Compatibility
calls assert zero loaded addons. Public dispatch stays timed; there is no hidden
native conversion or fallback preprocessing omitted from this API.

Fresh process per cell,1s warmup,9x100ms samples,two shuffled serial rounds. Consume
length/middle code unit, including rope access/materialization; batch elements are
consumed individually. No I/O/generation/logging in timed loops. No builds/tests
or substantial benchmark work ran concurrently. A small summary/read command ran
during the last batch window; that comparison claims no optimization.

Object per-cell MAD0.21–3.28%; process/run variation can be larger. Same-function
alias differences caution against isolated favorable cells. No exact cause of
variation is asserted. RSS/maxRSS are not per-operation allocation/retention/peak
costs. Other platforms/Node versions are UNVERIFIED for this fresh timing matrix.

Initial harness selftests exposed repository ESM self-reference without a consumer
manifest. A distinct manifest and asserted export URL fixed it before timing.
Those2 failed harness groups are not product failures or passed evidence. Current
runner requires explicit candidate selection; historical snapshots are untouched.

## Compatible object APIs

Median ops/s, round1 / round2. Every public named function below uses JS.

| Input | Upstream | CJS stringify | CJS stableStringify | ESM stringify | ESM stableStringify |
|---|---:|---:|---:|---:|---:|
| Config |119283 /134572|121624 /134961|116484 /134811|119023 /133752|130833 /134480|
| Lock |2067 /2020|1879 /2162|2084 /2107|1841 /2126|2033 /2068|
| Full API |153.9 /175.7|156.8 /176.1|173.2 /177.4|150.1 /175.8|172.1 /175.6|
| Upstream fixture |57181 /65791|64521 /64247|62679 /65697|64371 /66043|64879 /66410|
| CLDR Bengali |7620 /7894|7958 /8000|7909 /8094|7843 /8098|7174 /8223|
|32 comments |33972 /36259|34572 /36292|34967 /36440|35661 /36443|35797 /36379|
| One user |332600 /340552|334233 /347746|333430 /346604|349830 /342565|339111 /343568|

Full API CJS is+1.9% /+0.24%, config+2.0% /+0.29%, comments+1.8% /+0.09%.
Lock changes sign(-9.1% /+7.0%). Apparent first-round fixture gains disappear in
round2(CJS-2.35%). No repeated material compatibility improvement is demonstrated.

## Explicit object-to-native roundtrip

Full caller pipeline `stringifyJson(JSON.stringify(value))`, compared with direct
upstream. Exact output equality holds for these JSON-only fixtures; this pipeline
does not preserve arbitrary live-JS callback/getter/comparator semantics.

| Input | Roundtrip ops/s round1 /2 | Delta vs direct upstream round1 /2 |
|---|---:|---:|
| Config |166747 /168247|+39.8% /+25.0%|
| Lock |2361 /2396|+14.2% /+18.6%|
| Full API |180.3 /177.3|+17.2% /+0.93%|
| Upstream fixture |78658 /80054|+37.6% /+21.7%|
| CLDR Bengali |6186 /6213|-18.8% /-21.3%|
|32 comments |40336 /42864|+18.7% /+18.2%|
| One user |402923 /416806|+21.1% /+22.4%|

No automatic route is added: selected JSON-only gains do not preserve arbitrary
JS semantics, and workload-dependent losses remain.

## Existing-text sorting: separate API

Both start with identical normalized JSON text. Native includes public guards,
limits, complete napi input/output transfers and core. Baseline is parse+upstream.

| Text input | Native ops/s round1 /2 | Parse+upstream ops/s round1 /2 | Native delta |
|---|---:|---:|---:|
| Lock |3558 /3451|1427 /1393|+149.3% /+147.7%|
| Full API |249.6 /204.7|146.3 /143.3|+70.6% /+42.8%|
| CLDR Bengali |9569 /9311|5165 /5110|+85.3% /+82.2%|

The lower second API median is retained despite within-cell MAD below1%; no cause
is asserted. These are not object API gains. Never subtract these process timings
to claim an isolated conversion cost. CLDR's text win coexists with roundtrip loss.

## Raw-text selection

Existing text to raw selected JSON; baseline parse+same selection+JSON.stringify.
All fields exist, and exact strings match. Paths: lock `/name`, API
`/users/0/email`, CLDR `/main/bn/localeDisplayNames/languages/en`.

| Text input | Native ops/s round1 /2 | Baseline ops/s round1 /2 | Native delta |
|---|---:|---:|---:|
| Lock |7024 /6999|4980 /4956|+41.1% /+41.2%|
| Full API |535.2 /526.5|712.7 /712.4|-24.9% /-26.1%|
| CLDR Bengali |8762 /8680|17497 /17110|-49.9% /-49.3%|

Selection retains a niche lock use case, not a general parsing replacement.
Text/selection per-cell MAD0.32–1.77%.

## Batch and cache usefulness

32 real comment JSON strings, created before timing. Current batch34913 /34898
ops/s vs old34629 /35020: +0.82% /-0.35%, no material snapshot-fix regression.
Current same-native repeated loop36397 /37643: batch4.1% /7.3% slower.
Batch MAD0.35–1.98%. Retain ordered convenience, aggregate bounds and indexed
errors without an acceleration/boundary-amortization claim.

JS batching is also convenience; its older measurements are not refreshed by this
native-batch comparison. Explicit-version caching has earlier independent real
pool evidence; no cache gain is derived from uncached measurements here. Cache
and compatibility implementations are unchanged by current security fixes. No new
worker, adaptive dispatcher or advanced feature is introduced.
