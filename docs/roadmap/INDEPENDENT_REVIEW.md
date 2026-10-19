# Independent implementation and benchmark review

Date: 2026-10-19 (Asia/Dhaka; raw artifact timestamps use UTC).
Reviewer: separate harness test-review subagent, with ownership limited to
`tests/review.test.cjs` and this report. Implementation changes were made by the
lead, not the reviewer. Reviewed `js/index.ts`, `src/engine.rs`, `src/lib.rs`,
`benches/run.cjs`, fixtures, the pinned upstream source and architecture decisions.
Environment: Windows x64, Node v24.20.0, rustc 1.98.1. Base Git revision during
verification: `41f6d0a3d481169bcf9b15d092394db6a6b9524c`; implementation uncommitted.

## Findings and corrections

1. **Comparator capture and receiver: fixed and verified.** Original wrapper read
   `opts.cmp` during every comparison and invoked it as an options method. Upstream
   reads it twice during setup, captures the second result, and invokes it without
   a receiver. Getter events, mutation, thrown errors and strict `this` could differ.
   Differential regressions exercise all these cases against fresh input factories.
   Lead identified this independently as well and corrected it before the first
   executed review test; the initial defect was found by source inspection.
2. **Array iterator effects on object key traversal: fixed and verified.** A
   `for...of` loop over object keys observed a modified Array iterator, whereas
   upstream indexes the keys directly. Lead changed the loop to indexed access.
   An isolated child process patches the iterator and compares exact output.
3. **Lossy UTF-16 native boundary: fixed in the public wrapper and verified.**
   Node-API string conversion replaced a literal unpaired surrogate with U+FFFD.
   Public text APIs now reject ill-formed UTF-16 before conversion. Tests cover
   both ends of each surrogate range, native batches, valid emoji pairs and
   preserved escaped `\\ud800` value tokens. Internal native binding access is
   outside the public wrapper contract.
4. **Native startup measurement gap: reported to lead.** Requiring the public JS
   wrapper alone excludes lazy native loading. A fresh-process first native call
   or native binding require measurement is required to characterize addon startup.
5. **Deep text performance regression: measured and reported.** See evidence
   below. The engine repeatedly validates/parses nested raw subtrees, a plausible
   source-level explanation for the depth cost, not a completed profiler finding.

No unresolved critical defect was identified in the reviewed public API scope.
This is a bounded review, not proof of complete correctness or production readiness.

## Executed verification

All commands ran locally on 2026-10-19 against the actual release addon already
built by the lead. The reviewer did not independently rebuild release binaries;
`cargo test` independently compiled the Rust test target.

| Command | Outcome |
|---|---|
| `node --test tests/review.test.cjs` | PASS: 11/11, zero skipped |
| `cargo test --locked` | PASS: 3 Rust tests, zero failures; zero doc tests |
| `node --test tests/*.test.cjs tests/*.test.mjs` | PASS: 24/24, zero skipped; includes 6,000 JS generated cases and 3,000 native generated cases |
| `pnpm test:types` | PASS, compiler exit 0 |

Additional adversarial coverage includes getter/proxy/toJSON event traces,
unsupported values, BigInt exception behavior, repeated references, sparse batches,
version-required cache hits, NaN and signed-zero version identity, failed cache
entries, delete/clear, malformed text, decoded duplicate keys at nested depths,
UTF-16 key ordering, huge exponent token preservation, escaped scalar tokens,
UTF-8 byte limits, depth limits and batch error indexing.

Deep untrusted JSON with 129, 10,000 and 100,000 nested arrays was executed in a
child process. Each returned an ordinary error; child exit 0, no crash or signal.
Self-cyclic JavaScript arrays intentionally preserve upstream stack-overflow
RangeError behavior even with `cycles:true`; tests isolate both implementations
in child processes. Object cycles use upstream's documented behavior.

## Benchmark review and independent sample

Methodology correctly consumes output, checks exact expected output before timing,
warms each method, uses seven samples, records medians/MAD, isolates each cell in
a fresh process, preserves raw artifacts and distinguishes native text from object
conversion and ordinary JSON.stringify. Memory figures include fixture/runtime
costs; timer probes describe blocking bursts, not request latency or async behavior.
No serializer allocation-count measurement is available. Batch comparisons include
an additional JSON.stringify of result arrays; both candidates pay it, but it can
hide differences in batching cost. Fixed method order and 35 ms samples are
exploratory and remain subject to GC, thermal state and OS scheduling effects.
Cache hits assume unchanged identity/version and are not ordinary serialization.

Independent targeted serial command (PowerShell):

```powershell
$env:BENCH_DATASETS='tiny,wide,deep'
$env:BENCH_METHODS='upstream-from-text,native-text'
$env:BENCH_REPS='7'
$env:BENCH_SAMPLE_MS='35'
node benches/run.cjs
```

Raw artifact: `benches/results/2026-10-18T23-59-44-673Z-9500.json`.
Both methods consume pre-existing JSON text; the JS comparator includes
JSON.parse plus upstream stable serialization. Conversion of an existing JS object
to text is excluded. These synthetic samples supplement the broader real-fixture
benchmark and must not be generalized into a package-wide speed claim.

| Dataset | JS parse + upstream ops/s | Native text ops/s |
|---|---:|---:|
| tiny | 1,156,295 | 1,539,999 |
| wide | 2,424 | 3,389 |
| deep | 30,825 | 10,681 |

The native deep workload is approximately 65% slower in this run. Native text
improvements on two samples do not show that the compatibility stringify API is
Rust accelerated; it deliberately remains JavaScript. No cross-platform conclusion
is justified by these measurements.

Preserved earlier artifact
`benches/results/2026-10-18T23-59-31-806Z-30564.json` overlapped Rust and JS test
execution. Exclude it from performance conclusions. The subsequent run above was
executed after those verification commands completed, with no concurrent work
launched by the reviewer.

## Remaining verification boundaries

- Linux x64 and macOS ARM64 execution: NOT RUN by this reviewer.
- Packed-artifact installation, CI and dependency audits: owned by the lead and
  must be checked separately; not implied by these passing review tests.
- Long-running fuzzing, exhaustive allocation profiling and production event-loop
  workloads: NOT RUN. Deterministic generated cases are not exhaustive fuzzing.
- Resource limits protect native processing after input transfer; they do not
  avoid allocation of an already-existing JS string or every boundary copy.
- Public compatibility inherits upstream recursion limits and array-cycle quirks.
  It is not a hardened untrusted-live-object serializer.
