'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { stringifyJson, stringifyJsonBatch } = require('../js/index.cjs');
const oracle = require('../upstream/fast-json-stable-stringify');

test('native output preserves exact code units across encodings, sizes and Unicode densities', () => {
  const characters = ['a', 'é', 'Ā', 'বাংলা', 'العربية', '東京', '😀', '\u{10ffff}'];
  const inputs = [];
  for (const character of characters) {
    for (const length of [1, 127, 511, 512, 1023, 1024, 2048]) {
      const value = { z: character.repeat(length), a: [character, 'x'.repeat(32)] };
      const input = JSON.stringify(value);
      const expected = oracle(value);
      assert.equal(stringifyJson(input), expected);
      inputs.push(input);
    }
  }
  for (const fraction of [0, 0.01, 0.05, 0.10, 0.125, 0.25, 0.5, 1]) {
    const value = { z: 'a'.repeat(8000 - Math.floor(8000 * fraction)) + '😀'.repeat(Math.floor(2000 * fraction)) };
    const input = JSON.stringify(value);
    assert.equal(stringifyJson(input), oracle(value));
    inputs.push(input);
  }
  assert.deepEqual(stringifyJsonBatch(inputs), inputs.map(input => oracle(JSON.parse(input))));
});

test('native encoding route never normalizes raw scalar tokens or changes errors', () => {
  const text = 'বাংলা😀'.repeat(512);
  const input = `{"z":"${text}\\ud800","b":[1.00,-0,1e+30,"\\u0061"],"\\u0061":2}`;
  const expected = `{"a":2,"b":[1.00,-0,1e+30,"\\u0061"],"z":"${text}\\ud800"}`;
  assert.equal(stringifyJson(input), expected);
  assert.deepEqual(stringifyJsonBatch(['{}', input, '"\\ud800"']), ['{}', expected, '"\\ud800"']);
  assert.throws(() => stringifyJson(`{"a":1,"\\u0061":"${text}"}`), /Duplicate/);
  assert.throws(() => stringifyJson(JSON.stringify({ x: text }), { maxBytes: 128 }), /byte limit/);
  assert.throws(() => stringifyJson('"\ud800"'), TypeError);
  assert.throws(() => stringifyJsonBatch([input, '"\udfff"']), TypeError);
});
