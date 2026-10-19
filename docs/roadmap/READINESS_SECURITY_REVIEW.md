# Independent readiness security and correctness review

Date: 2026-10-19. Reviewer operated independently of production implementation.
Baseline: `a406f93` on `perf/independent-reproduction`; Windows x64,
Node 24.20.0, Rust 1.98.1. No publishing or remote modifications occurred.

## Confirmed defect: validation/native batch input mismatch

The public `stringifyJsonBatch` wrapper previously checked types with the
caller's `.some` method, checked Unicode and aggregate bytes using the caller's
iterator, then passed the original array to napi-rs. Native `Vec<String>`
conversion reads indexed properties again. Those three views can differ.

Minimal reproducible case on the baseline release addon:

```js
const inputs = ['"\ud800"'];
inputs[Symbol.iterator] = function* () {};
stringifyJsonBatch(inputs); // ['"�"'] instead of the promised TypeError
```

A stateful indexed getter returning valid strings for the first two reads and
an ill-formed string for the third also silently changed the serialized text.
An options getter could mutate the source array after validation. This is an
observable correctness defect and a bypass of promised Unicode/aggregate-input
validation. It does not establish memory corruption: native per-document and
aggregate byte limits still apply after native conversion, and Rust is safe code.

Recommended fix: capture and validate array length; read indexed values once
into a fresh dense array; check types, Unicode and byte counts on those exact
values; pass only that snapshot to native code. Ignore caller `.some`/iterator
overrides. Snapshot before reading option getters. Preserve input order,
document limits, indexed native errors, and no-partial-result behavior.

Permanent regressions: `tests/readiness-security.test.cjs`, with iterator and
method overrides, a changing getter/read count, sparse slot, fractional Proxy
length, and options getter mutation. Implementation belongs to the lead agent.

## Executed baseline adversarial checks

Command: `node --test tests/readiness-security.test.cjs`.
Baseline result: 7 groups, 5 PASS and 2 expected FAIL (the confirmed batch defect).
Additional snapshot/Proxy/options cases were then added. After the lead's indexed
snapshot correction and fresh release/JS build, both commands passed all 8 groups:

```powershell
node --test tests/readiness-security.test.cjs
./.tools/node-v22.13.0-win-x64/node.exe --test tests/readiness-security.test.cjs
```

Executed 2026-10-19 on Windows x64, Node 24.20.0 and 22.13.0 respectively.
Each run: 8 PASS, 0 FAIL, 0 skipped. The actual built JS wrapper/native addon
were used. Source review confirms that the fix removes method/iterator/reread
validation mismatches and captures values before option getter execution.
Global intrinsic/prototype monkeypatching is outside this review's guarantees.
Do not count the intentional baseline failures as passed checks.

The five passing groups independently verified:

- Exact UTF-8 byte-boundary acceptance/rejection for all three public native APIs,
  including `InvalidArg` native error codes.
- Prototype-like keys remain serialized data; escaped decoded duplicate keys
  fail; sorting/selection do not mutate `Object.prototype`.
- An isolated subprocess survives 100,000 nested containers for sorting,
  selection and batching, with structured errors. Valid depths 1, 8, 64 and 128
  succeed; configured smaller bounds reject. Child exit 0, no signal.
- Importing and using compatibility stringify succeeds while native loading is
  forcibly unavailable; native calls expose the original load error and retry
  successfully after the loader obstruction is removed.
- Failed cache versions are retried; changing version covers accessor/comparator
  state; unchanged versions intentionally retain cached output.

Source review covered `src/{lib,engine,tree,selection,output}.rs`, the TypeScript
wrapper, generated loader, exports, security/API/architecture documents, and
existing differential/adversarial tests. The structural scanner is only called
after full serde validation; depth and byte errors prevent unchecked slicing on
invalid public input. The output routing samples byte slices, not UTF-8 string
slices, so sampling inside multibyte characters does not corrupt text.

## Fresh dependency and license evidence

Command: `pnpm audit:deps` (2026-10-19T01:21:02Z).
Result: PASS; pnpm audit exit 0, license enumeration exit 0, OSV queried all
38 locked registry crates with no advisory matches and no pagination/error.
pnpm reported zero advisories at all severities. Raw responses:
`docs/audits/2026-10-19T01-21-02-497Z/{pnpm-audit,npm-licenses,rust-licenses,rust-osv}.json`.
The script queries only public package/version data. This does not certify
absence of vulnerabilities or replace runtime review. License declarations were
enumerated, not individually re-audited as legal conclusions.

## Related limit getter defect found during lead review

The lead identified a second validation/use mismatch in the shared text options
helper: it validated `maxDepth` and `maxBytes`, then read both getters again when
constructing the native argument tuple. A changing getter could therefore cause
native code to receive a different value, including `undefined` (the default).

```js
let reads = 0;
stringifyJson('[[0]]', {
  get maxDepth() { return ++reads === 1 ? 1 : undefined; }
}); // Previously succeeded at default depth instead of applying validated 1.
```

Native hard caps remained enforced, but the explicitly validated caller limits
could be bypassed. The ninth security regression group covers depth and byte
getters across sorting, batching and selection, successful one-read order, and
invalid-depth short circuit before accessing `maxBytes`. The executed pre-fix
compiled-wrapper run produced 8 PASS / 1 expected FAIL (missing nesting error).
The lead owns the fix: retain each value during validation and pass that exact
tuple to the native function. After the fresh compiled wrapper incorporated this
fix, the same two Node 24/22 commands above each passed all 9 groups, zero failed,
zero skipped (2026-10-19). Independent source review confirms one getter read
per option and preserved depth-before-bytes validation/error order.

## Remaining production limits

Native calls are synchronous. Node-API copies incoming strings before Rust can
enforce byte limits. Token-tree allocations and temporary dense UTF-16 output
can multiply input size, and OOM can terminate a process. Bounded JSON bytes are
not a complete RSS budget. Compatibility traversal intentionally executes
user callbacks/getters/proxies and follows upstream stack-overflow behavior;
it is not a sandbox. Native limits do not apply to that JS API. Cached output
requires correct caller versions, including external state changes.

Generated loader environment overrides are an explicit executable-code loading
mechanism; never treat untrusted process environment as a safe artifact selector.
No new loader behavior was added. Linux/macOS execution, combined three-native
artifact installation and unavailable runtime/platform variants remain
UNVERIFIED until the respective real jobs execute.

## Final packed candidate independent identity review

Executed 2026-10-19T01:46:00Z on Windows x64 / Node24.20.0 with independent
Node stdin assertions, `tar -xzOf` returning binary buffers, SHA-256 and actual
installed `createRequire`/API/`require.cache` observations. No rebuild, repack or
benchmark occurred in this review.

- Final source: `fc006f9efa8516bcb43ca29d5228decf11d9691a`; runtime frozen at
  `757bc263d0ce9c6774da5fd68e3f7b9935e152ef`.
- Candidate: `.verification/readiness-final-01/stable-json-rs-0.1.0.tgz`;
  SHA-256 `b424ebbc68d01fe6031ed40d8d17ecc9e1f459cce5bd84f5296cba042956957a`.
- All 9 reviewed packed runtime/manifest files match the actual prior measured
  benchmark candidate bytes, not merely their declared manifest hashes. Eight
  wrapper/type/loader/addon files also match the current tested source bytes.
- Actual extracted native, both npm/pnpm installed and loaded native, prior
  benchmark packed native and compiled release DLL all have SHA-256
  `96ba87bcc9a76f9c2cce21cede7ef74ea10e69b147a69b5435536f1ce81c5f86`.
- Both actual installed consumers independently passed compatible stringify,
  native text sorting and the changing-index batch snapshot regression; actual
  locally installed addon paths were observed after calls.
- Inspected all four current checksum-bound verification reports: npm/pnpm on
  Node22.13.0/24.20.0, each PASS for CJS/ESM/strict declarations/native behavior.
  Report verifier hashes match the present verifier. This independent process
  loaded Node24; Node22/full type execution is evidence from the four inspected
  executed reports, not a new independent run.

Append-only report:
`.verification/readiness-final-01/independent-review-2026-10-19T01-46-00-687Z.json`.
The lead may retain a compact copy with other final evidence. Initial reviewer
assertions incorrectly expected raw source `package.json` bytes, then all source
fields, to survive packing unchanged. Actual pnpm packing normalizes formatting
and omits the source-only `packageManager` field. The corrected assertion allows
only that specific known omission; every other parsed field matches and packed,
installed and prior benchmark manifest bytes are exactly equal. These were
reviewer harness corrections, not runtime failures or unexplained source drift.

No further release-blocking correctness/security issue was found in frozen
runtime source review. This is a host-only tarball, not a combined artifact;
foreign binaries, actual cross-platform installations and hosted CI execution
remain NOT RUN and cannot be inferred from these checks.
