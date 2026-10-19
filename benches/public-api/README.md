# Installed public object API comparison

Set `PUBLIC_API_CANDIDATE=.verification/readiness-benchmark-01` explicitly before
timing. The current runner refuses implicit timing candidates; recreate/install
a verified candidate if ignored binary artifacts are absent.

`node --test benches/public-api/run.test.cjs` checks all exact outputs and fixture
provenance without timing. `node benches/public-api/run.cjs` measures seven real
inputs, six methods and two shuffled serial runs in fresh processes. Selftests
can fall back to the retained original installation at
`.verification/final-output-ee4b51b/npm`; current verification and timing must
explicitly select the security-fixed candidate above.

Each cell uses one second of warmup and nine 100ms measurements. Dataset reading,
JSON parsing, expected-result generation, module loading and fixture selection
occur before timing. Each output's length and middle code unit are consumed;
this includes rope materialization costs for both serializers. Every cell checks
the exact serialized string against the pinned upstream. Raw samples, median,
MAD, latency, output throughput, CPU, end-of-cell memory and process maxRSS are
preserved. Those memory observations are not allocation or retained-memory costs.

CJS resolves the installed package's root export. An ignored generated ESM
consumer uses a directory junction to the installed package and imports its bare
package name, exercising Node's actual import condition. Both named aliases are measured. They are the
same underlying function today. Compatibility methods assert that no native addon
loads. The native roundtrip includes `JSON.stringify` on every invocation plus
the complete public text wrapper and native transfer/return costs; it is equivalent
only for these verified JSON-only fixtures, not arbitrary JavaScript values.

Run timing serially with other tests/builds stopped. Environment overrides:
`PUBLIC_API_CANDIDATE`, `PUBLIC_API_DATASETS`, `PUBLIC_API_METHODS`,
`PUBLIC_API_RUNS`, `PUBLIC_API_WARMUP_MS`, `PUBLIC_API_SAMPLE_MS`,
`PUBLIC_API_SAMPLES`. `PUBLIC_API_CHECK_ONLY=1` performs no timing. Immutable runner
snapshots and append-only raw reports preserve the exact experiment source.
Do not generalize the separate existing-JSON-text results to these object APIs.

`PUBLIC_API_BATCH=1` compares the current candidate's public native batch with
the retained original candidate's batch and the current candidate's same-native
loop on 32 real API comments. Inputs are serialized outside timing for all three;
the returned strings are consumed individually, with no extra JSON serialization.

`PUBLIC_API_TEXT=1` (batch flag cleared) separately compares current native text
sorting versus parse+upstream and raw selection versus parse+select+JSON.stringify,
on dependency-lock/API/CLDR data. Paths and exact outputs are verified. These24
cells are separate from the object API. See
`docs/roadmap/PUBLIC_API_PERFORMANCE_REVIEW.md` for current measurements and limits.
