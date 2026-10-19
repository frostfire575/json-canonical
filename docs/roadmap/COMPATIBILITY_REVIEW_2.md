# Independent compatibility review, second pass

Date: 2026-10-19. Reviewer: independent compatibility subagent. Starting source
commit: `113a8eb`. Oracle: pinned MIT `fast-json-stable-stringify` commit
`49e230da2c84247b29ad4de02c9395793caefd15`. This review owns only this report and
`tests/expanded-compatibility.test.cjs`; implementation changes belong to the lead.

## Scope and method

Read AGENTS.md, handoff, plan, tasks, progress, benchmark history, architecture,
decisions, public API and compatibility status; inspected the original traversal,
TypeScript traversal, native bindings, bounded Rust engine/scanner and prior tests.
The compatibility API intentionally executes in JavaScript. Testing it is not
evidence that arbitrary objects are serialized in Rust.

The new suite compares exact strings and, for stateful factories, exception names,
exception messages and ordered observation events. Each implementation receives
a separately recreated fixture; mutation by the first execution cannot contaminate
the second. Exceptions thrown as non-Error values are compared by identity/value.
Process-wide intrinsic modifications and recursive array cycles run in an isolated
child process, with timeout and exit/signal checks.

Added coverage:

- 8192 deterministic IEEE-754 bit patterns plus explicit subnormal, rounding,
  exponent threshold, signed-zero and nonfinite cases.
- 2048 arbitrary UTF-16 strings/keys, including lone and paired surrogates,
  controls, combining characters and supplementary characters. Tests also call
  the actual native API: supported values retain exact strings; unsupported
  malformed scalar-Unicode keys must throw.
- 1000 seeded nested DAGs with shared references, unsupported values, unusual
  keys and reverse comparators.
- Inherited and accessor-based toJSON; receiver/argument counts; changed call
  targets; returned objects with their own toJSON; mutating getters; array growth
  and truncation; inherited sparse elements.
- Comparators that mutate keys/values, return ties or throw; invalid comparators;
  revoked proxies; duplicate ownKeys traps; non-Error throws.
- Mixed object/array graph cycles; repeated frozen references; toJSON that creates
  or removes cycles, with all documented cycles options.
- 30000 realistic-shaped records and an extremely wide 40000-key object, compared
  exactly through both public compatibility and actual native text APIs.
- Isolated Object.keys, isFinite and JSON.stringify hooks; array cycles remain
  upstream RangeError behavior with either cycles setting.

Generated corpora are deterministic. Large fixture construction is for correctness
coverage, not benchmark evidence; no timings here support throughput claims.

## Execution evidence

Environment: Windows x64, Node `v24.20.0`, rustc
`1.98.1 (48a229cea 2026-09-01)`. Upstream checkout SHA was independently checked
with `git -C upstream/fast-json-stable-stringify rev-parse HEAD` and matches the
pin above. The actual Windows release addon used by the tests has SHA-256
`154D1683EC0DB600A2053528C08D776AC123367FB9AFEE573CB173466C14E0A1`.

Commands executed on 2026-10-19, after the lead's isolated timing window closed:

| Command | Result |
|---|---|
| `node --test tests/expanded-compatibility.test.cjs`, first attempt | FAIL: 9 passed, 1 failed; an overly specific test error-message regex rejected a valid structured native error |
| Same command after correcting the test expectation | PASS: 10 passed, 0 failed, no skips; duration 335.4177 ms |
| `pnpm test` | PASS: 43 passed, 0 failed, no skips; duration 437.3268 ms |
| `cargo test --locked` | PASS: 5 Rust unit tests; 0 doctests; no failures |
| `pnpm test:types` | PASS: strict consumer TypeScript compilation, exit 0 |

The initial test expected an unsupported lone surrogate key diagnostic to contain
the word surrogate/Unicode. Serde also legitimately reports `unexpected end of
hex escape` when the isolated surrogate ends the key. The API promises structured
`Error` with `code === 'InvalidArg'`, not a particular diagnostic phrase. The test
was corrected to assert that documented type and code. No source code was changed,
no input was excluded and no successful output was substituted for the rejection.
The deterministic Unicode corpus then completed in full.

The new suite contributes 11240 generated compatibility inputs (8192 + 2048 +
1000), plus fixed adversarial fixtures. Its 2048 Unicode cases additionally run
native scalar-string serialization and native key acceptance/rejection. The full
suite now contains 25740 generated inputs across the existing and new corpora;
this is a count of corpus cases, not distinct test-runner assertions.

## Findings and limits

No source defect was uncovered by the executed tests or inspection. This is a compatibility
review, not an exhaustive JavaScript semantics proof or native memory-safety audit.
Array/deep object stack capacity is engine-dependent; only exception class, not
the precise recursion depth or stack trace, is compared for runaway array cycles.
Linux/macOS execution is not available to this reviewer and remains UNVERIFIED.
Release compilation, strict TypeScript and whole-suite verification are integrated
and recorded by the lead; they must not be inferred from this targeted report.

Separately inspected benchmark harness source: preparation is outside the timed
loop, equality is checked before measurement and native public calls include
boundary costs. Its final exit status checks ERROR rather than INCOMPATIBLE or
UNAVAILABLE, so the lead was informed to inspect every raw result status. This
source review does not independently reproduce any benchmark number.
