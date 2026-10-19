# Independent packed output candidate review

Date: 2026-10-19. Reviewer: independent compatibility/output subagent.
Candidate directory: `.verification/final-output-ee4b51b`. No builds, repacking,
installation or production edits were performed by this review.

## Candidate identity

- Manifest source commit: `ee4b51b260be4993a7097fcd1624dca2660ad7d5`.
- Tarball: `stable-json-rs-0.1.0.tgz`.
- Tarball SHA-256:
  `644220b6316efacad54546c124e1e1260efc18679a54ff9eef724f6c96232fff`.
- Windows addon SHA-256:
  `96ba87bcc9a76f9c2cce21cede7ef74ea10e69b147a69b5435536f1ce81c5f86`.

Inspected both `scripts/verify-ci-candidate.cjs` and
`scripts/verify-installed-identity.cjs`. The former checks the same manifest
tarball identity, tests installed CJS/ESM/native APIs and strict packed consumer
types, and records manager/runtime outcomes. Its added native cases exercise
dense Unicode, Latin-1, supplementary characters, exact code units, raw scalar
tokens/escaped lone surrogates, batches, malformed input and cache invalidation.
It never builds or repacks in verify mode; installation is a separate step.

The identity verifier checks the tarball hash, all recorded outcomes, installed
runtime/declaration/loader hashes against the checkout, and the actual `.node`
module loaded from each installed consumer. This closes the gap between a passing
development addon and tests accidentally loading a different installed binary.
It also verifies the installed performance document exists. It does not establish
that every target binary is present unless the broader verifier is invoked with
`--all-targets`; this local candidate is explicitly host-only.

## Independently executed checks

Both commands passed on Windows x64, loading the npm and pnpm installed addons:

```powershell
node scripts/verify-installed-identity.cjs .verification/final-output-ee4b51b
.\.tools\node-v22.13.0-win-x64\node.exe scripts/verify-installed-identity.cjs .verification/final-output-ee4b51b
```

Evidence written without overwriting prior results:

- Node 24.20.0:
  `.verification/final-output-ee4b51b/source-identity-2026-10-19T01-13-05-450Z-23392.json`.
- Node 22.13.0:
  `.verification/final-output-ee4b51b/source-identity-2026-10-19T01-13-16-610Z-12172.json`.

Each execution compares all eight runtime/declaration/binding files for both npm
and pnpm consumers and confirms one native module actually loaded from each
consumer's own package directory. The loaded native hashes match the addon hash
above and the compiled release addon in the checkout.

A separate Node stdin assertion pass independently checked that exactly four
`verification-*.json` reports existed, one per matrix entry below, with PASS,
`win32/x64`, matching candidate source commit/hash, and
`allTargetsRequired === false`. All assertions passed:

| Installer | Node | Recorded installed CJS/ESM/types/native result |
|---|---|---|
| npm | 22.13.0 | PASS |
| npm | 24.20.0 | PASS |
| pnpm | 22.13.0 | PASS |
| pnpm | 24.20.0 | PASS |

This matrix was inspected independently; the full CJS/ESM/type verifier executions
are the lead's four preserved reports, not additional full runs by this reviewer.
The reviewer did independently execute the identity/runtime-loading checks on both
Node versions as recorded above.

The stdin pass additionally extracted the Windows binary directly from the tarball
using `tar -xOf ... package/native/stable-json-rs.win32-x64-msvc.node` through
Node's binary `execFileSync` return buffer. Its SHA-256 matched both the declared
compiled addon hash above and `native/stable-json-rs.win32-x64-msvc.node` in the
checkout. No text transcoding was involved. Thus the packed binary, both installed
runtime binaries and the checked development release binary have identical bytes.

## Conclusion and remaining gates

No identity or installed-output defect found. The four existing packed-consumer
reports refer to one identical final tarball, and the installed runtime files
independently matched the checked release addon on both available Node versions.

Linux x64, macOS ARM64 and the combined multi-target package remain UNVERIFIED:
this candidate contains only the Windows addon, and these checks cannot substitute
for execution on those hosts. No package was published, pushed or released.
