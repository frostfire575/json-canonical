'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('../js/index.cjs');
const binding = require('../native/binding.js');
const oracle = require('../upstream/fast-json-stable-stringify');

test('output review: exact byte and Unicode-density boundaries return primitive strings', () => {
  const inputs = [], expected = [];
  // Root quoted strings permit exact output byte control. Exercise the >=1024
  // gate and different concentrated Unicode densities regardless of routing.
  for (const bytes of [1022, 1023, 1024, 1025, 1026, 2047, 2048, 2049]) {
    const threshold = Math.floor(bytes / 8);
    for (const count of [0, 1, Math.floor(threshold / 2) - 1, Math.floor(threshold / 2), Math.floor(threshold / 2) + 1]) {
      const text = 'é'.repeat(count) + 'a'.repeat(bytes - 2 - count * 2);
      const token = JSON.stringify(text);
      assert.equal(Buffer.byteLength(token), bytes);
      const output = api.stringifyJson(token);
      assert.equal(typeof output, 'string');
      assert.equal(output, token);
      assert.equal(binding.stringifyJson(token), token);
      inputs.push(token); expected.push(token);
    }
  }
  assert.deepEqual(api.stringifyJsonBatch(inputs), expected);
  assert.deepEqual(binding.stringifyJsonBatch(inputs), expected);
});

test('output review: UTF16 path preserves supplementary scalars, noncharacters and raw escapes', () => {
  const alphabet = '\u0000\b\f\n\r\t"\\/ée\u0301\u2028\u2029\ufffe\uffff\u{10000}\u{1f600}\u{10ffff}বাংলা';
  const values = [
    { z: alphabet.repeat(200), '\u{10000}': alphabet.repeat(100), '\ue000': 'a', a: '\ud800\udfff\ud800' },
    ['😀'.repeat(1024), '\ud800', '\udfff', alphabet.repeat(100)],
  ];
  for (const value of values) {
    const input = JSON.stringify(value), expected = oracle(value);
    const output = api.stringifyJson(input);
    assert.equal(output, expected);
    assert.equal(typeof output, 'string');
    assert.deepEqual([...output].map(character => character.codePointAt(0)), [...expected].map(character => character.codePointAt(0)));
  }
  const literal = '😀বাংলা'.repeat(300);
  const input = '{"z":"' + literal + '\\ud800\\uDFFF\\/\\u0061","a":[-0.000,1E+9999,0.10]}';
  const expected = '{"a":[-0.000,1E+9999,0.10],"z":"' + literal + '\\ud800\\uDFFF\\/\\u0061"}';
  assert.equal(api.stringifyJson(input), expected);
  assert.deepEqual(api.stringifyJsonBatch(['"ascii"', input, JSON.stringify(values[0])]), ['"ascii"', expected, oracle(values[0])]);
});

test('output review: UTF8 byte limits and atomic batch errors remain enforced before encoding', () => {
  const input = JSON.stringify({ z: '😀বাংলা'.repeat(200), a: 1 });
  const bytes = Buffer.byteLength(input);
  assert.equal(api.stringifyJson(input, { maxBytes: bytes }), oracle(JSON.parse(input)));
  assert.throws(() => api.stringifyJson(input, { maxBytes: bytes - 1 }),
    error => error instanceof Error && error.code === 'InvalidArg' && /byte limit/.test(error.message));
  for (const invalid of ['{"x":1,"\\u0078":2}', '{"\\ud800":0}', input + 'null', input.slice(0, -1)]) {
    assert.throws(() => api.stringifyJson(invalid), error => error instanceof Error && error.code === 'InvalidArg');
    assert.throws(() => api.stringifyJsonBatch([input, invalid]),
      error => error instanceof Error && error.code === 'InvalidArg' && /Batch item 1:/.test(error.message));
  }
  assert.throws(() => api.stringifyJsonBatch([input, '"\ud800"']), TypeError);
  assert.throws(() => api.stringifyJson('[[' + input + ']]', { maxDepth: 2 }), /nesting/);
  assert.equal(api.stringifyJson('[[' + input + ']]', { maxDepth: 3 }), '[[' + oracle(JSON.parse(input)) + ']]');
});

test('output review: sampled Unicode detection never changes prefix/tail/middle/block content', () => {
  const ascii = 'a'.repeat(8192), unicode = '😀বাংলা'.repeat(1024);
  const cases = [
    unicode + ascii, ascii + unicode, ascii + unicode + ascii,
    unicode + ascii + unicode,
    Array.from({ length: 16 }, (_, index) => index % 2 ? '😀'.repeat(32) : 'a'.repeat(896)).join(''),
    'a'.repeat(1020) + '😀' + 'b'.repeat(1020),
    'é'.repeat(512) + 'x'.repeat(16384),
  ];
  const inputs = cases.map(value => JSON.stringify({ z: value, a: ['\\ud800', '\u{10ffff}'] }));
  const expected = inputs.map(input => oracle(JSON.parse(input)));
  assert.deepEqual(inputs.map(input => api.stringifyJson(input)), expected);
  assert.deepEqual(inputs.map(input => binding.stringifyJson(input)), expected);
  assert.deepEqual(api.stringifyJsonBatch(inputs), expected);
});
