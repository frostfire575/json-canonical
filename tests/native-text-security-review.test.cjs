'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const api = require('../js/index.cjs');

const nativeError = error => error instanceof Error && error.code === 'InvalidArg';
const pointer = key => '/' + key.replace(/~/g, '~0').replace(/\//g, '~1');

test('native review3: scalar tokens are text, including out-of-range JS numbers', () => {
  const tokens = ['-0', '0.000', '1.2300E+004', '-1e-99999', '1e999',
    '900719925474099312345678901234567890', 'true', 'false', 'null',
    '"\\ud800"', '"\\udfff"', '"\\ud83d\\ude00"', '"\\u0061\\/\\b\\f\\n\\r\\t"'];
  for (const token of tokens) {
    assert.equal(api.stringifyJson(' \r\n' + token + '\t '), token);
    assert.equal(api.selectJson(' \r\n' + token + '\t ', ''), token);
    assert.equal(api.selectJson('{"x": ' + token + '}', '/x'), token);
  }
  assert.deepEqual(api.stringifyJsonBatch(tokens), tokens);
});

test('native review3: decoded key ordering uses UTF16 without Unicode normalization', () => {
  const keys = ['\ue000', '😀', '𐀀', 'a', 'aa', 'a\u0000', 'é', 'e\u0301',
    '\u0000', '\u0001', '\n', '/', '~', '\\', '"', '__proto__', 'constructor', '10', '2', '\uffff'];
  const text = '{' + keys.map((key, index) => JSON.stringify(key) + ':' + index).join(',') + '}';
  const expected = '{' + [...keys].sort().map(key => JSON.stringify(key) + ':' + keys.indexOf(key)).join(',') + '}';
  assert.equal(api.stringifyJson(text), expected);
  for (const key of keys) assert.equal(api.selectJson(text, pointer(key)), String(keys.indexOf(key)));
  assert.equal(api.stringifyJson('{"\\u0061":1,"\\/":2,"\\ud83d\\ude00":3}'), '{"/":2,"a":1,"😀":3}');
});

test('native review3: duplicates are decoded and rejected throughout sorted documents', () => {
  for (const text of ['{"a":1,"\\u0061":2}', '{"/":1,"\\/":2}',
    '{"😀":1,"\\ud83d\\ude00":2}', '{"\\u0000":1,"\\u0000":2}',
    '{"safe":0,"nested":[{"a":1,"\\u0061":2}]}']) {
    assert.throws(() => api.stringifyJson(text), error => nativeError(error) && /Duplicate/.test(error.message));
    assert.throws(() => api.stringifyJsonBatch(['0', text]), error => nativeError(error) && /Batch item 1/.test(error.message));
  }
  assert.equal(api.selectJson('{"a":1,"\\u0061":2}', '/a'), '2');
  assert.equal(api.selectJson('{"a":{"x":1},"a":{"x":2}}', '/a/x'), '2');
  assert.equal(api.selectJson('{"a":{"x":1},"a":null}', '/a/x'), undefined);
  assert.equal(api.selectJson('{"raw":{"a":1,"a":2}}', '/raw'), '{"a":1,"a":2}');
});

test('native review3: escaped surrogate keys follow distinct sort and extraction scopes', () => {
  for (const key of ['\\ud800', '\\udfff', '\\ud800x', '\\ud800\\ud800', '\\udfff\\ud800']) {
    const text = '{"good":1,"bad":{"' + key + '":2}}';
    assert.throws(() => api.stringifyJson(text), nativeError);
    assert.equal(api.selectJson(text, '/good'), '1');
    assert.equal(api.selectJson(text, '/bad'), '{"' + key + '":2}');
    assert.throws(() => api.selectJson(text, '/bad/missing'), nativeError);
    assert.equal(api.selectJson(text, ''), text);
  }
  assert.equal(api.stringifyJson('{"\\udbff\\udfff":1}'), '{"' + String.fromCodePoint(0x10ffff) + '":1}');
});

test('native review3: strict JSON syntax is checked even for missing or early selections', () => {
  const malformed = ['', '\ufeff{}', '[00]', '[+1]', '[.1]', '[1.]', '[1e]', '[NaN]', '[Infinity]',
    '[undefined]', '[1,]', '{"a":1,}', '{a:1}', '{"a":1} false', '/*x*/{}',
    '["\\uZZZZ"]', '["\\x41"]', '["\\u000"]', '["\u0000"]', '["\t"]',
    '{"good":1,"ignored":[1,]}', '{"good":1,"ignored":"\\q"}'];
  for (const text of malformed) {
    assert.throws(() => api.stringifyJson(text), nativeError, text);
    for (const selected of ['', '/good', '/missing'])
      assert.throws(() => api.selectJson(text, selected), nativeError, text + selected);
  }
});

test('native review3: pointer decoding is single-pass and scalar traversal is missing', () => {
  const keys = ['', '~', '/', '~0', '~1', '~01', 'a/b', 'a~b', '\u0000', '\n', 'বাংলা😀', '__proto__'];
  const text = '{' + keys.map((key, index) => JSON.stringify(key) + ':' + index).join(',') + '}';
  for (const key of keys) assert.equal(api.selectJson(text, pointer(key)), String(keys.indexOf(key)));
  for (const invalid of ['#', '#/a', 'a', '/~', '/~2', '/~00~', '/a~1b~9'])
    assert.throws(() => api.selectJson('{}', invalid), RangeError);
  for (const scalar of ['0', 'false', 'null', '"hello"'])
    assert.equal(api.selectJson(scalar, '/x'), undefined);
});

test('native review3: array index grammar differs from object member names', () => {
  const array = '[0,1,2]';
  for (const key of ['01', '00', '-0', '+0', '-', '', '1.0', '1e0', ' 0', '0 ', '٣', '３',
    '3', '4294967295', '18446744073709551615', '18446744073709551616', '9'.repeat(200)]) {
    assert.equal(api.selectJson(array, pointer(key)), undefined, key);
    assert.equal(api.selectJson('{' + JSON.stringify(key) + ':7}', pointer(key)), '7', key);
  }
  for (let index = 0; index < 3; index++) assert.equal(api.selectJson(array, '/' + index), String(index));
});

test('native review3: exact UTF8 and container limits apply to all APIs', () => {
  const text = '{"é":["😀বাংলা"]}';
  const bytes = Buffer.byteLength(text);
  for (const run of [
    options => api.stringifyJson(text, options),
    options => api.stringifyJsonBatch([text], options)[0],
    options => api.selectJson(text, '', options),
  ]) {
    assert.equal(run({ maxBytes: bytes, maxDepth: 2 }), text);
    assert.throws(() => run({ maxBytes: bytes - 1, maxDepth: 2 }), nativeError);
    assert.throws(() => run({ maxBytes: bytes, maxDepth: 1 }), nativeError);
  }
  for (const value of [0, -1, NaN, Infinity, 1.1, '1', null, 1n, {}, Symbol('limit')])
    for (const name of ['maxBytes', 'maxDepth'])
      for (const run of [() => api.stringifyJson('0', { [name]: value }),
        () => api.selectJson('0', '', { [name]: value }), () => api.stringifyJsonBatch(['0'], { [name]: value })])
        assert.throws(run, RangeError);
});

test('native review3: path bounds count raw UTF8 bytes and decoded segments', () => {
  const exact = '/' + 'é'.repeat(32767) + 'x';
  assert.equal(Buffer.byteLength(exact), 65536);
  assert.equal(api.selectJson('{}', exact), undefined);
  assert.throws(() => api.selectJson('{}', exact + 'x'), /64 KiB/);
  const root = '['.repeat(128) + '0' + ']'.repeat(128);
  assert.equal(api.selectJson(root, '/0'.repeat(128)), '0');
  assert.throws(() => api.selectJson(root, '/0'.repeat(129)), /128 segments/);
  assert.equal(api.selectJson('{}', '/' + '~0'.repeat(32767)), undefined);
});

test('native review3: caller exceptions propagate and invalid input prevents option callbacks', () => {
  const sentinel = new Error('review3 sentinel');
  const throwing = { get maxDepth() { throw sentinel; } };
  for (const run of [() => api.stringifyJson('0', throwing), () => api.selectJson('0', '', throwing),
    () => api.stringifyJsonBatch(['0'], throwing)]) assert.throws(run, error => error === sentinel);
  let reads = 0;
  const unused = { get maxDepth() { reads++; throw sentinel; } };
  for (const run of [() => api.stringifyJson(null, unused), () => api.stringifyJson('"\ud800"', unused),
    () => api.selectJson('0', 'bad', unused), () => api.selectJson('0', '/\ud800', unused),
    () => api.stringifyJsonBatch([null], unused)]) assert.throws(run, error => error !== sentinel);
  assert.equal(reads, 0);
});

test('native review3: deterministic independent lexical and selection corpus (2400 documents)', () => {
  let state = 0x731d2c4f;
  function next() { state = Math.imul(state, 1664525) + 1013904223 | 0; return state >>> 0; }
  const keys = ['a', '10', '2', 'é', 'e\u0301', 'বাংলা', '😀', '\ue000', '/', '~', '\u0000', 'constructor'];
  const tokens = ['0', '-0', '1.00', '1e999', '90071992547409931234567890', '"\\ud800"',
    '"\\u0061"', '"😀বাংলা"', 'true', 'false', 'null'];
  for (let index = 0; index < 2400; index++) {
    const chosen = new Set();
    while (chosen.size < 4) chosen.add(keys[next() % keys.length]);
    const fields = [...chosen].map(key => ({ key, token: tokens[next() % tokens.length] }));
    const body = fields.map(({ key, token }) => JSON.stringify(key) + ' : [ ' + token + ' ]').join(' , ');
    const input = ' { ' + body + ' } ';
    const expected = '{' + [...fields].sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0)
      .map(({ key, token }) => JSON.stringify(key) + ':[' + token + ']').join(',') + '}';
    assert.equal(api.stringifyJson(input), expected, 'document ' + index);
    for (const field of fields) {
      assert.equal(api.selectJson(input, pointer(field.key)), '[ ' + field.token + ' ]');
      assert.equal(api.selectJson(input, pointer(field.key) + '/0'), field.token);
    }
    assert.equal(api.selectJson(input, '/missing'), undefined);
  }
});

test('native review3: adversarial malformed/deep corpus cannot crash isolated native binding', () => {
  const code = `
    const assert = require('node:assert/strict');
    const api = require('./js/index.cjs');
    for (const count of [129, 1024, 65536]) {
      const input = '['.repeat(count) + '0' + ']'.repeat(count);
      for (const run of [() => api.stringifyJson(input), () => api.selectJson(input, '/0'),
        () => api.stringifyJsonBatch([input])]) assert.throws(run, error => error.code === 'InvalidArg');
    }
    const fragments = ['{', '[', '\\"', '\\\\', '0', ':', ',', '}', ']', ' ', '\\n'];
    let state = 918273;
    for (let i = 0; i < 1000; i++) {
      let text = '';
      for (let j = 0; j < 48; j++) { state = Math.imul(state, 1103515245) + 12345 | 0; text += fragments[(state >>> 0) % fragments.length]; }
      let valid = true;
      try { JSON.parse(text); } catch { valid = false; }
      for (const run of [() => api.stringifyJson(text), () => api.selectJson(text, '/missing')]) {
        if (!valid) assert.throws(run, error => error.code === 'InvalidArg');
        else run();
      }
    }
  `;
  const result = spawnSync(process.execPath, ['-e', code], { cwd: path.join(__dirname, '..'), encoding: 'utf8', timeout: 15000 });
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr);
});
