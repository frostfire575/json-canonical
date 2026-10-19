'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('../js/index.cjs');
const oracle = require('../upstream/fast-json-stable-stringify');
const binding = require('../native/binding.js');

test('release binding smoke and UTF-16 ordering', () => {
  assert.equal(binding.stringifyJson('{"b":2,"a":1}'), '{"a":1,"b":2}');
  assert.equal(api.stringifyJson('{"\ue000":0,"😀":1}'), '{"😀":1,"\ue000":0}');
  assert.equal(api.stringifyJson(' [1.00, 1e+30, -0, "\\ud800", "\\u0061"] '), '[1.00,1e+30,-0,"\\ud800","\\u0061"]');
});
test('native malformed input, decoded duplicates, byte/depth limits', () => {
  for (const input of ['', 'NaN', 'undefined', '{}[]', '[1,]', '{"a":1,"\\u0061":2}', '{"\\ud800":1}', '["\u0001"]'])
    assert.throws(() => api.stringifyJson(input));
  assert.throws(() => api.stringifyJson('[[0]]', { maxDepth: 1 }), /nesting/);
  assert.equal(api.stringifyJson('[0]', { maxDepth: 1 }), '[0]');
  assert.throws(() => api.stringifyJson('"😀"', { maxBytes: 5 }), /byte limit/);
  for (const options of [{ maxBytes: 0 }, { maxDepth: 129 }, { maxDepth: 1.5 }, { maxBytes: NaN }])
    assert.throws(() => api.stringifyJson('0', options), RangeError);
  assert.throws(() => api.stringifyJson({ a: 1 }), TypeError);
  assert.throws(() => binding.stringifyJson(123));
});
test('native text and batch preserve exact output for 3000 supported JSON objects', () => {
  let seed = 42;
  function rand() { seed = Math.imul(seed, 1664525) + 1013904223 | 0; return seed >>> 0; }
  const inputs = [];
  for (let i = 0; i < 3000; i++) {
    const value = { z: [rand(), { b: 'বাংলা😀\\\n', a: rand() / 101 }], '10': rand(), '2': rand(), a: i };
    const input = JSON.stringify(value);
    const expected = oracle(value);
    assert.equal(api.stringifyJson(input), expected);
    inputs.push(input);
    if (inputs.length === 100) {
      assert.deepEqual(api.stringifyJsonBatch(inputs), inputs.map(x => oracle(JSON.parse(x))));
      inputs.length = 0;
    }
  }
});
test('native batch errors and limits', () => {
  assert.deepEqual(api.stringifyJsonBatch([]), []);
  assert.throws(() => api.stringifyJsonBatch(['{}', 'bad']), /Batch item 1/);
  assert.throws(() => api.stringifyJsonBatch(Array(1025).fill('0')), /1024/);
  assert.throws(() => api.stringifyJsonBatch([undefined]), TypeError);
  assert.throws(() => binding.stringifyJsonBatch(Array(1025).fill('0')), /1024/);
});
