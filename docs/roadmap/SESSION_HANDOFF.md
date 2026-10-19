# Session handoff

- Current phase: native text positioning verified; final packaged artifact gate active.
- Branch: docs/native-text-positioning, basef7b1f73. Master unchanged, no remote actions.
- Last completed task:162independent existing-text cells +12newadversarial groups;
  original sorting gains repeated, extraction narrow; actual optional consumers
  PASS on22/24 with verified Node24metadata toolhost.
- Currently active task: NT-VERIFY final pack and installed examples/identities.
- Next recommended task: commit verified source/docs/evidence, pack into NEW
  .verification/native-text-final-01, manifest/prepare, both offline installers,
  CJS/ESM/strictTS/native on22/24 and examples; compare runtime to measured bytes.
- Files changed: native-first README/API/performance/architecture/security;
  newCJS/ESM/TSexamples andpackageallowlist/description/bench:text;74JS groups;
  independenttext runner/rawcorpus/report; distributionprototype/diagnostic/reports;
  Node24CIbuildhosts and source/installedexamples checks; roadmap/audits.
- Tests passing: finalreleasebuild,5Rust74JS/strictTS;74JS onNode22;12legacy,
  6priorpublic and7newtext harnessgroups (new7pass on22/24); independentsecurity
  12groupsbothruntimes;3examplemodes executed/typechecked; fmt/clippy/actionlint;
  fresh0pnpmadvisory/0OSVmatches38lockedcrates; realWindowsoptionalprototype
  7controlsPASS eachconsumer22/24 usingNode24metadata;162timedexactpre/postchecks
  andactualcorpus/frozenrunner/installedreleaseidentityverificationPASS.
- Tests failing: Node22Windowsnapi3.10.8 create-npm-dirs stalls from inconsistent
  fstat/lstatdeviceidentities; boundeddiagnostic confirms, originalfailurepreserved.
  Node24toolhost avoids it, butNode22CLIgenerationisnotpassed. No failingruntime
  test or knownnewcriticalissue. Missingcombined gate intentionallyrejects.
- Latest benchmark results:3freshshuffledpasses,1swarmup,9x>=100ms/cell,Windows24.
  Originalsort native vsparse+upstream:lock2392/2397/2339 vs1017/774/1090;
  API178/172/178 vs115/106/112; CLDR6698/6422/5975 vs3988/3937/3972ops/s.
  All5originalfiles win, notuniversal. JSlockpass2MAD16.54% retained. Directselect
  normalizedlock5581/5602/5912 vs3671/3599/3804; original6-13%gainnotrepeat10%;
  allotherdirectcontrolslose. WholeprocessRSS includes setup, noallocationclaim.
  NATIVE_TEXT_REVIEW_2.md and benches/native-text-verification/results retain
  fullinputs/outputs/rawsamples/machine/commit/byteidentities. NoNode22perfclaim.
- Outstanding problems: Linux/macOS genuinecombinedbuild/load/install andhosted
  3build+6consumerjobs NOTRUN. Noremoteconfigured, noDockerdaemon/macOShost;
  Rust1.88minimum NOTRUN. NoV8allocationcounts, isolatedAPIpeakRSS orfullstackprofile.
- Architectural decisions: native textsort primarymeasuredperformanceAPI;
  selectJson boundedrawtexttoolwithconditionalgain. CompatibilitydefaultunchangedJS,
  noautomaticconversion/nativefallback. Batchconvenienceandexplicitversioncache
  retainedwithoutnewtuning. Combinedroottar preferred; splitoptionalprovesfeasibility
  only, rootdoesnotdependonunpublishedpackages. Node24buildtools vs22/24consumers.
  Parse/stream/async/hash deferred; no publication/push/release approved.
- Relevant Git reference:f7b1f73a0057e582f73068b5500dbb9ad82eafa3 base; nextcommit
  records measuredpositioning/sourcechecks. Runtime unchangedfrom757bc26.
- Measuredcandidate:.verification/readiness-final-01/stable-json-rs-0.1.0.tgz,
  SHAb424ebbc68d01fe6031ed40d8d17ecc9e1f459cce5bd84f5296cba042956957a;
  native96ba87bcc9a76f9c2cce21cede7ef74ea10e69b147a69b5435536f1ce81c5f86.
  Metadata/docs/exampleschange, runtime8filesunchanged; finalproofpendingnewpack.

## Exact resume commands
Read AGENTS and required roadmap/architecture/compatibility/decisions first.
Buildtools Node24, runtime consumers22/24:
```powershell
git status --short
git log -4 --oneline
pnpm check
./scripts/verify-node22.ps1
.tools/actionlint/actionlint.exe .github/workflows/ci.yml
$env:NATIVE_TEXT_CANDIDATE='.verification/readiness-final-01'
node --test benches/native-text-verification/run.test.cjs
node benches/native-text-verification/verify-evidence.cjs benches/native-text-verification/results/2026-10-19T09-56-55-718Z-33544.json
node benches/native-text-verification/verify-evidence.cjs benches/native-text-verification/results/2026-10-19T10-01-50-243Z-33224.json
pnpm exec node scripts/distribution-review/run.cjs
```
See TEST_RESULTS and runnerREADME for exact timing/directmethod filters and
installercommands. Time onlywithCPUquiet, explicitinstalledcandidate. Do not
rerun failedNode22metadata unbounded; boundeddiagnose-cli.cjs preserves proof.
For Node22optionalconsumers setNAPI_METADATA_NODE toactualNode24 before invoking
Node22script. Packnewdironce, neveroverwriteolderrawresults/manifests/candidates.
