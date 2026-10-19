import assert from 'node:assert/strict';
import { stringifyJson, selectJson, stringify } from 'stable-json-rs';
const input = '{"z":1.00,"users":[{"name":"Ada","id":7}],"a":-0}';
const options = { maxDepth: 32, maxBytes: 1024 * 1024 };
const ordered = stringifyJson(input, options);
assert.equal(ordered, '{"a":-0,"users":[{"id":7,"name":"Ada"}],"z":1.00}');
const rawName = selectJson(input, '/users/0/name', options);
assert.equal(rawName, '"Ada"');
// Live JavaScript values use the separate compatibility traversal, without Rust.
assert.equal(stringify({ z: 1, a: 0 }), '{"a":0,"z":1}');
console.log(ordered);
console.log(JSON.parse(rawName));
