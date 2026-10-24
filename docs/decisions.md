# Decisions

Newest first. Each entry records what was chosen, what it was weighed against,
and the evidence.

## D9. Rewrite from scratch on `rewrite/v2` (2026-10-24)

The 0.1 design validated with serde, then scanned the text a second time to build
a token tree, and its main export was a copy of fast-json-stable-stringify in
JavaScript. Review found the double pass, a selection path that re-parsed the
subtree at every path segment, string-typed errors, and no answer for the main
reason people sort JSON keys: hashing and signatures. 0.1 remains on `master`.

## D8. RFC 8785 is the primary operation

Sorting keys alone does not make equal values produce equal bytes, because number
and string spellings still differ. JCS is the published standard for that, so it
is the headline function, and `sortKeys` stays for people who must keep
spellings. `canonicalHash` and `equal` are thin conveniences on top of it.

## D7. No compatibility clone of fast-json-stable-stringify

The 0.1 `stringify` export reproduced upstream quirks in JavaScript and had no
measured advantage. Dropped. `canonicalizeValue` covers live objects with defined
semantics instead.

## D6. Correct shortest digits instead of trusting `{:e}`

Fuzzing against `String(Number)` found doubles where Rust's shortest formatting
picks a non-closest digit. Correct rounding to the shortest length fixes it at
the cost of a second format for 16 to 17 digit values. A Ryu-family formatter
would remove that cost but needs a dependency (for example `ryu-js`, which
formats exactly like JavaScript); not added without approval. Float-heavy input
is the one measured case slower than V8.

## D5. Encode large strings in JavaScript, not through Node-API

Measured on 4 to 8 MB documents: Node-API string conversion took longer than the
parse itself. `TextEncoder.encodeInto` into a reused buffer is faster from 1 KiB
up and slower below it, hence the threshold.

## D4. Zero-dependency core

The engine needs no parser, formatter or SIMD crate to beat `JSON.parse` on
validation. Fewer dependencies keep the audit surface and the build small.
`serde_json` stays as a dev-dependency oracle for the Rust tests.

## D3. Errors are an enum with stable codes

Each `ErrorKind` maps to one `ERR_JSON_*` code exposed as `error.code`, with byte
offset, line and UTF-16 column, so callers can branch on the cause and show
where it is.

## D2. Lone surrogates

RFC 8259 grammar accepts `"\ud800"`, and so does `JSON.parse`, so validation,
minify, sort and select accept it. RFC 8785 requires valid Unicode, so
canonicalization rejects it. A lone surrogate *character* in a JavaScript string
cannot be encoded as UTF-8 at all, so every function rejects that input.

## D1. Duplicate keys

`select` and `validate` follow `JSON.parse` (accepted, last wins). `sortKeys` and
`canonicalize` reject them, because two equal keys have no defined order and
RFC 8785 forbids them.
