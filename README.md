<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/frostfire575/json-canonical/main/docs/images/hero-dark.svg">
    <img src="https://raw.githubusercontent.com/frostfire575/json-canonical/main/docs/images/hero.svg" alt="Two differently written JSON files go through jcanon and come out as the same canonical bytes and the same SHA-256 hash" width="100%">
  </picture>
</p>

<h1 align="center">
  json-canonical
  <img
    src="https://visitor-badge.laobi.icu/badge?page_id=frostfire575.json-canonical&left_text=Repo%20Views&left_color=0d1117&right_color=0d1117"
    alt="Visitors"
    height="24"
  >
</h1>

<p align="center"><strong>RFC 8785 canonical JSON for Node, computed from the text by a Rust engine: hash it, sign it, compare it.</strong></p>

<p align="center">
  <a href="#quick-start">Quick start</a> · <a href="#performance">Performance</a> · <a href="#api">API</a> · <a href="#command-line">Command line</a> · <a href="docs/architecture.md">How it works</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/json-canonical"><img src="https://img.shields.io/npm/v/json-canonical" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/json-canonical"><img src="https://img.shields.io/npm/dt/json-canonical?label=total%20downloads&amp;color=brightgreen" alt="Lifetime npm downloads"></a>
  <a href="https://github.com/frostfire575/json-canonical/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/frostfire575/json-canonical/ci.yml?branch=main&amp;label=CI&amp;logo=github" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT"></a>
  <a href="https://www.npmjs.com/package/json-canonical"><img src="https://img.shields.io/node/v/json-canonical" alt="Node.js version"></a>
  <a href="package.json"><img src="https://img.shields.io/badge/dependencies-0-brightgreen.svg" alt="Zero runtime dependencies"></a>
  <a href="https://github.com/frostfire575/json-canonical/issues"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs welcome"></a>
</p>

**json-canonical turns JSON text into one exact byte sequence per value**, following
RFC 8785 (JCS). Two services that write `1.50` and `1.5`, or put keys in a
different order, get the same bytes and therefore the same hash or signature.
The same engine sorts keys while keeping every number exactly as written,
minifies, validates with line and column errors, and reads values by JSON Pointer,
all without building JavaScript objects.

## Why use it?

- **Hashes and signatures that agree.** `JSON.stringify` output depends on key
  insertion order. The "stable stringify" packages fix the order but still print
  `1.0`, `1e21` and `"\u00e9"` however the value came in. RFC 8785 fixes all of it.
- **Faster than parsing first.** `canonicalize(text)` runs 1.4 to 2.7 times faster
  than `JSON.parse` plus `canonical-json`, with the same bytes out.
- **Big integers survive `sortKeys`.** An ID like `12345678901234567890` keeps every
  digit, where `JSON.parse` has already rounded it.
- **Checked against V8.** Numbers print exactly as `String(n)` does (one million
  seeded doubles in the tests), and keys sort by UTF-16 code units, as JavaScript
  sorts strings.

## Table of contents

- [Quick start](#quick-start)
- [Performance](#performance)
- [What canonical means](#what-canonical-means)
- [API](#api)
- [Command line](#command-line)
- [Coming from canonical-json or json-stable-stringify](#coming-from-canonical-json-or-json-stable-stringify)
- [Platforms](#platforms)
- [Building from source](#building-from-source)
- [License](#license)

## Quick start

**Requirement:** Node.js 22.13 or later on a [supported platform](#platforms).

1. Install the package:

   ```sh
   npm install json-canonical
   ```

2. Canonicalize and hash some JSON:

   ```js
   // order.js
   const json = require('json-canonical');

   json.canonicalize('{ "b": [1.0, 1e21], "a": "\\u00e9" }');
   // '{"a":"é","b":[1,1e+21]}'

   json.canonicalHash('{"a":1}');
   // '015abd7f5cc57a2dd94b7590f04ad8084273905ee33ec5cebeae62276a97f862'
   ```

3. Or use the command line that comes with it:

   ```sh
   npx jcanon hash order.json
   ```

ESM works the same way: `import { canonicalize } from 'json-canonical'`. Types are
included.

## Performance

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/frostfire575/json-canonical/main/docs/images/speedup-dark.svg">
    <img src="https://raw.githubusercontent.com/frostfire575/json-canonical/main/docs/images/speedup.svg" alt="canonicalize is 1.37x to 2.67x faster than JSON.parse plus canonical-json and 2.03x to 3.96x faster than JSON.parse plus json-stable-stringify across seven fixtures" width="100%">
  </picture>
</p>

The speed comes from never building JavaScript objects: one pass over the bytes
validates and writes the output at the same time. Passing a `Buffer` straight from
`fs.readFile` or a socket also skips string transcoding.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/frostfire575/json-canonical/main/docs/images/operations-dark.svg">
    <img src="https://raw.githubusercontent.com/frostfire575/json-canonical/main/docs/images/operations.svg" alt="Speedup of each operation over the fastest JavaScript baseline per fixture; select on package.json and equal on most fixtures are slower" width="100%">
  </picture>
</p>

Not everything wins. `select` on a 1.8 KB file loses to `JSON.parse` because the
call into native code costs more than parsing something that small. `equal` is
slower than `util.isDeepStrictEqual` on most inputs, because it canonicalizes both
documents in full; choose it when RFC 8785 semantics matter (`-0` equals `0`,
duplicate keys throw), not for speed.

All numbers come from one Windows machine (i7-12700K, Node 24.22). Linux and macOS
have not been benchmarked. Method, raw samples and every table are in
[docs/performance.md](docs/performance.md).

## What canonical means

RFC 8785 picks one spelling for everything that JSON lets you write several ways:

| You wrote | Canonical form | Rule |
|---|---|---|
| `{"b":1,"a":2}` | `{"a":2,"b":1}` | keys sorted by UTF-16 code units |
| `1.0`, `2e0`, `1.50` | `1`, `2`, `1.5` | numbers printed as JavaScript prints them |
| `1e21` | `1e+21` | same rule, exponent form included |
| `"\u00e9"` | `"é"` | strings use escapes only where required |
| spaces and newlines | none | no insignificant whitespace |

Two things here are easy to get wrong. Rust's shortest float formatting picks a
different last digit than JavaScript for some doubles (`113017829008754.13` where
JavaScript prints `.12`), so the engine carries a port of Ryu that follows the
ECMA-262 rule. And `😀` (U+1F600) sorts before U+FFFF, because UTF-16 order differs from
code point order for characters above U+FFFF. [docs/architecture.md](docs/architecture.md)
explains both.

## API

Every function accepts a string, a `Buffer` or any `Uint8Array` holding UTF-8.

| Function | Returns |
|---|---|
| `canonicalize(input, options?)` | RFC 8785 text. Rejects duplicate keys, lone surrogates and numbers beyond the double range. |
| `sortKeys(input, options?)` | Keys sorted at every level, whitespace removed, number and string tokens unchanged. Rejects duplicate keys. |
| `minify(input, options?)` | Whitespace removed, everything else unchanged. |
| `validate(input, options?)` | Nothing; throws on invalid JSON. Strict RFC 8259. |
| `isValid(input, options?)` | `true` or `false`. |
| `select(input, pointer, options?)` | Raw text of the value at an RFC 6901 pointer, or `undefined`. The last duplicate key wins, as in `JSON.parse`. |
| `equal(a, b, options?)` | Whether both texts are the same JSON value under RFC 8785. |
| `canonicalHash(input, options?)` | Digest of the canonical form. `algorithm` is anything `crypto.createHash` accepts (default `sha256`); `encoding` is `hex` (default), `base64` or `base64url`. |
| `canonicalizeValue(value)` | RFC 8785 text for a live JavaScript value, in plain JavaScript. |

`canonicalize`, `sortKeys` and `minify` have `Async` variants (`canonicalizeAsync`
and so on) that run on the libuv thread pool and return a promise. Use them for
multi-megabyte input on a server, since the plain calls block the event loop.

```js
// examples.js
json.sortKeys('{"id":12345678901234567890,"price":1.10,"b":0}');
// '{"b":0,"id":12345678901234567890,"price":1.10}'

json.equal('{"a":[1,2]}', '{ "a" : [1.0, 2e0] }');
// true

json.select('{"users":[{"email":"ada@example.com"}]}', '/users/0/email');
// '"ada@example.com"'
```

### Options

| Option | Default | What it changes |
|---|---|---|
| `maxDepth` | `128` | Deepest nesting allowed, 1 to 1024. |
| `maxBytes` | `67108864` (64 MiB) | Largest input, and separately the largest output. Up to 2^30. |
| `output` | `'string'` | `'buffer'` returns a `Buffer`. `canonicalize`, `sortKeys` and `minify` only. |
| `strictNumbers` | `false` | Throw `ERR_JSON_PRECISION` when the canonical number would denote a different decimal than the input, such as an integer ID above 2^53 losing its last digits. `0.1` passes, since it prints back as `0.1`. Applies to `canonicalize`, `canonicalHash` and `equal`. |

RFC 8785 itself rounds to the nearest double, which is why `strictNumbers` is off
by default.

### Errors

Invalid input throws `JsonError`, a `SyntaxError` with `code`, `offset` (UTF-8
bytes), `line` and `column` (UTF-16 units, as editors count).

```js
// errors.js
try {
  json.canonicalize('{"a":1,"a":2}');
} catch (err) {
  err.code;    // 'ERR_JSON_DUPLICATE_KEY'
  err.message; // 'duplicate object key at line 1 column 8'
}
```

| Code | Thrown when |
|---|---|
| `ERR_JSON_SYNTAX` | The text is not valid RFC 8259 JSON. |
| `ERR_JSON_ENCODING` | The bytes are not valid UTF-8, or a string holds a lone surrogate character. |
| `ERR_JSON_DEPTH` | Nesting is deeper than `maxDepth`. |
| `ERR_JSON_SIZE` | Input or output is larger than `maxBytes`. |
| `ERR_JSON_DUPLICATE_KEY` | An object repeats a key (`canonicalize`, `sortKeys`). |
| `ERR_JSON_LONE_SURROGATE` | An escape such as `"\ud800"` has no pair (`canonicalize`). |
| `ERR_JSON_NUMBER_RANGE` | A number is beyond the double range (`canonicalize`). |
| `ERR_JSON_PRECISION` | `strictNumbers` is on and a number would print differently. |

A bad argument is not a `JsonError`: an option of the wrong type throws `TypeError`,
and a limit out of range or a malformed pointer throws `RangeError`.

## Command line

The package installs `jcanon`, also available as `json-canonical`. It reads a file,
or standard input when the file is left out or given as `-`.

```sh
jcanon canonicalize order.json > order.canonical.json
jcanon hash order.json                     # sha256 hex, then a newline
jcanon hash --algorithm sha512 --encoding base64 order.json
curl -s https://api.example.com/users | jcanon select /0/email
jcanon sort-keys package.json
jcanon equal a.json b.json && echo same
jcanon validate bad.json                   # bad.json:1:8: expected a string key (ERR_JSON_SYNTAX)
```

`canonicalize`, `sort-keys`, `minify` and `select` write the exact output bytes, so
piping `jcanon canonicalize` into `sha256sum` hashes the canonical form. When
standard output is a terminal they add a newline so the prompt starts on its own
line. `--max-depth`, `--max-bytes` and `--strict-numbers` work like the options
above.

| Exit status | Meaning |
|---|---|
| `0` | Success. |
| `1` | The JSON was rejected, `equal` found different values, or `select` matched nothing. |
| `2` | A bad argument, or a file that cannot be read. |

`jcanon --help` lists every command and flag.

## Coming from canonical-json or json-stable-stringify

Both take a JavaScript value, so with JSON text you call `JSON.parse` first. This
package skips that step and produces the same bytes: 1.4 to 2.7 times faster than
`JSON.parse` plus `canonical-json`, and 2.0 to 4.0 times faster than `JSON.parse`
plus `json-stable-stringify`, on the benchmark fixtures. Integers above 2^53 stay
exact in `sortKeys`, where `JSON.parse` has already rounded them.

Stay with those packages when:

- you start from an object built in code. `canonicalizeValue` here is plain
  JavaScript and slower than `canonical-json`;
- you need a browser or another runtime, or `replacer` and indentation;
- your input has duplicate keys or lone surrogates that `JSON.parse` accepts.
  This package throws on them.

## Platforms

Prebuilt addons ship for Windows x64, Linux x64 and ARM64 (glibc) and macOS ARM64.
CI tests each of them on Node 22.13 and 24.22. Alpine (musl), Intel Macs and
Windows ARM have no prebuilt addon yet.

Each release is published from CI through npm trusted publishing, with a
provenance attestation linking the tarball to the commit that built it.

## Building from source

You need Rust stable, Node 24 and pnpm 12.

```sh
pnpm install --frozen-lockfile
pnpm check        # build, rustfmt, clippy, Rust tests, JS tests, type tests
pnpm test:pack    # install the packed tarball into a fresh project and run it
pnpm bench        # end-to-end benchmarks, raw results in benches/results
python scripts/gen-docs-graphics.py   # redraw docs/images from the results
```

`crates/core` is the engine: plain Rust with no dependencies, usable on its own.
`crates/node` is the Node-API binding and `js/` the TypeScript wrapper.
[docs/architecture.md](docs/architecture.md) walks through the design, and
[docs/decisions.md](docs/decisions.md) records why it is built this way.

## License

MIT, see [LICENSE](LICENSE). The number formatter is a port of Ryu under the Boost
Software License; [NOTICE](NOTICE) has the details.
