# stable-json-rs

Canonical JSON for Node, written in Rust. It turns JSON text into one exact byte
sequence per value (RFC 8785, JCS), so you can hash it, sign it, cache by it or
compare it. The same single-pass engine also sorts keys while keeping every
number exactly as written, minifies, validates with line and column errors, and
extracts values by JSON Pointer without building JavaScript objects.

Status: 0.2.0, a from-scratch rewrite. Not published. CI passes on Windows x64,
Linux x64 and macOS ARM64 with Node 22.13 and 24.22. Benchmarks are from Windows only.

```js
const json = require('stable-json-rs');

json.canonicalize('{ "b": [1.0, 1e21], "a": "\\u00e9" }');
// '{"a":"é","b":[1,1e+21]}'

json.canonicalHash(fs.readFileSync('order.json'));       // sha256 hex of the canonical form
json.equal('{"a":[1,2]}', '{ "a" : [1.0, 2e0] }');        // true

json.sortKeys('{"id":12345678901234567890,"price":1.10,"b":0}');
// '{"b":0,"id":12345678901234567890,"price":1.10}'  (JSON.parse would round the id)

json.select(body, '/users/0/email');                       // '"ada@example.com"' or undefined
```

## Why it exists

`JSON.stringify` output depends on key insertion order, and the popular "stable
stringify" packages only sort keys. They give different bytes for `1.0` and `1`,
for `"A"` and `"A"`, and they need the whole document parsed into objects
first. When two services have to agree on a hash or a signature, those
differences break verification. RFC 8785 defines one output for every JSON value,
and this package implements it on the text directly.

Two things about that are easy to get wrong, and the test suite checks both
against V8 itself:

- Numbers must print exactly as `Number.prototype.toString` prints them. Rust's
  own shortest formatting picks a different digit for some doubles
  (`113017829008754.13` where JavaScript prints `.12`); the engine corrects for
  this, and one million seeded doubles match `String(n)`.
- Keys sort by UTF-16 code units, not by code points or UTF-8 bytes, so `😀` sorts
  before `￿`. The engine compares UTF-8 bytes directly and fixes up the one
  range where the two orders disagree.

## API

Every function accepts a string, a `Buffer` or any `Uint8Array` holding UTF-8.
Invalid input throws `JsonError`, a `SyntaxError` with `code`, `offset` (UTF-8
bytes), `line` and `column` (UTF-16 units, as editors count).

| Function | Result |
|---|---|
| `canonicalize(input, options?)` | RFC 8785 text. Rejects duplicate keys, lone surrogates, numbers beyond the double range. |
| `sortKeys(input, options?)` | Keys sorted at every level, whitespace removed, number and string tokens unchanged. Rejects duplicate keys. |
| `minify(input, options?)` | Whitespace removed, everything else unchanged. |
| `validate(input, options?)` / `isValid` | Throws or returns a boolean. Strict RFC 8259. |
| `select(input, pointer, options?)` | Raw text of the value at an RFC 6901 pointer, or `undefined`. Last duplicate key wins, as in `JSON.parse`. |
| `equal(a, b, options?)` | Whether both texts are the same JSON value. |
| `canonicalHash(input, { algorithm, encoding })` | Digest of the canonical form, default sha256 hex. |
| `canonicalizeValue(value)` | RFC 8785 for a live JavaScript value, in plain JavaScript. |

`canonicalize`, `sortKeys` and `minify` take `{ output: 'buffer' }` to return a
`Buffer`, and each has an `...Async` variant that runs on the libuv thread pool.
Options shared by all functions: `maxDepth` (1 to 1024, default 128) and
`maxBytes` (default 64 MiB, applied to input and output separately).
`strictNumbers: true` makes canonicalization throw `ERR_JSON_PRECISION` when the
output would denote a different decimal value than the input, such as an integer
ID above 2^53 losing its last digits. `0.1` passes, since it prints back as `0.1`.
RFC 8785 itself rounds, so the default does too.

Error codes: `ERR_JSON_SYNTAX`, `ERR_JSON_ENCODING`, `ERR_JSON_DEPTH`,
`ERR_JSON_SIZE`, `ERR_JSON_DUPLICATE_KEY`, `ERR_JSON_LONE_SURROGATE`,
`ERR_JSON_NUMBER_RANGE`, `ERR_JSON_PRECISION`.

## Command line

The package installs a `stable-json` command with the same operations. It reads
a file, or standard input when the file is left out or given as `-`.

```sh
stable-json canonicalize order.json > order.canonical.json
stable-json hash order.json                     # sha256 hex, then a newline
stable-json hash --algorithm sha512 --encoding base64 order.json
curl -s https://api.example.com/users | stable-json select /0/email
stable-json sort-keys package.json
stable-json validate config.json                # config.json:2:11: expected a JSON value (ERR_JSON_SYNTAX)
stable-json equal a.json b.json && echo same
```

`canonicalize`, `sort-keys`, `minify` and `select` write the exact output bytes,
so piping `stable-json canonicalize` into `sha256sum` hashes the canonical form.
When standard output is a terminal they add a newline so the prompt starts on its
own line. `--max-depth`, `--max-bytes` and `--strict-numbers` work as the options
above. The exit status is 0 on success, 1 when the JSON is rejected, `equal`
finds different values or `select` matches nothing, and 2 for a bad argument or
a file that cannot be read. `stable-json --help` lists everything.

## Performance

Measured on an i7-12700K, Windows 11, Node 24.22, string in and string out,
against the JavaScript pipeline you would write otherwise (`JSON.parse` followed
by a serializer, or property access for `select`). All outputs are
checked before timing. The full table, raw samples and method are in
[docs/performance.md](docs/performance.md).

| Fixture | canonicalize | sortKeys | validate | select |
|---|---:|---:|---:|---:|
| npm package-lock, 144 KB | 3.7x | 2.4x | 2.0x | 2.0x |
| JSONPlaceholder data, 1.4 MB | 2.3x | 1.4x | 1.4x | 1.4x |
| package.json, 1.8 KB | 2.7x | 1.8x | 1.2x | **0.9x** |
| records with Unicode, indented, 8 MB | 2.6x | 2.0x | 1.1x | 1.1x |
| same records, already sorted, 6 MB | 4.2x | 3.4x | 1.4x | 1.4x |
| 200k random doubles, 4 MB | 1.6x | 4.2x | 1.6x | 1.5x |

Each figure is the median of three pinned runs; single runs vary by up to about
30% on the small fixtures.

The speedup comes from never building JavaScript objects. Passing a `Buffer`
straight from `fs.readFile` or a socket also skips string transcoding, and for
canonicalization of large input that is up to 6.6x faster than the JavaScript
pipeline.

Numbers with up to 15 significant digits (prices, counters, most coordinates) are
re-spelled without touching floating point. Longer ones go through a port of the
Ryu algorithm. On tiny documents the Node-API call overhead is a large share of
the time, which is why `select` on package.json loses.

Calls are synchronous, so use the `Async` variants for multi-megabyte input on a
server.

## Building

Rust stable, Node 24 and pnpm 12.

```sh
pnpm install --frozen-lockfile
pnpm check        # build, rustfmt, clippy, Rust tests, JS tests, type tests
pnpm test:pack    # install the packed tarball into a fresh consumer and run it
pnpm bench
```

The Rust engine lives in `crates/core` with no dependencies and can be used on its
own. `crates/node` is the Node-API binding and `js/` the TypeScript wrapper.

MIT licensed.
