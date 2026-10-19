// Start with existing JSON text. Scalar spelling (1.00 and -0) is preserved.
const assert = require('node:assert/strict');
const { stringifyJson, selectJson } = require('stable-json-rs');
const input = '{"z":1.00,"users":[{"name":"Ada","id":7}],"a":-0}';
const options = { maxDepth: 32, maxBytes: 1024 * 1024 };
const ordered = stringifyJson(input, options);
assert.equal(ordered, '{"a":-0,"users":[{"id":7,"name":"Ada"}],"z":1.00}');
const rawName = selectJson(input, '/users/0/name', options);
assert.equal(rawName, '"Ada"');
assert.equal(selectJson(input, '/missing', options), undefined);
// Extracted containers retain their original key order; extraction is not sorting.
assert.equal(selectJson(input, '/users/0', options), '{"name":"Ada","id":7}');
console.log(ordered);
console.log(JSON.parse(rawName));
