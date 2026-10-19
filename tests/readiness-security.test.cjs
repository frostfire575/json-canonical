'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const api = require('../js/index.cjs');

test('readiness: native batches validate the exact indexed snapshot sent to Rust', () => {
  const invalid = ['"\ud800"'];
  invalid[Symbol.iterator] = function* () {};
  assert.throws(() => api.stringifyJsonBatch(invalid), TypeError);

  let reads = 0;
  const changing = [];
  Object.defineProperty(changing, 0, { enumerable: true, get() {
    return ++reads <= 2 ? '"ok"' : '"\ud800"';
  } });
  assert.deepEqual(api.stringifyJsonBatch(changing), ['"ok"']);
  assert.equal(reads, 1, 'each index is read once before validation/native conversion');
});

test('readiness: native batch validation cannot be replaced by instance methods', () => {
  const inputs = [null];
  inputs.some = () => false;
  inputs[Symbol.iterator] = function* () {};
  assert.throws(() => api.stringifyJsonBatch(inputs), TypeError);
  assert.throws(() => api.stringifyJsonBatch(Array(1)), TypeError);
  assert.throws(() => api.stringifyJsonBatch(new Proxy([], { get(target, key) {
    return key === 'length' ? 0.5 : Reflect.get(target, key);
  } })), RangeError);
});

test('readiness: options callbacks cannot change the already validated native batch snapshot', () => {
  const inputs = ['"ok"'];
  const options = { get maxDepth() { inputs[0] = '"\ud800"'; return 128; } };
  assert.deepEqual(api.stringifyJsonBatch(inputs, options), ['"ok"']);
});

test('readiness: byte limits use UTF-8 bytes for all public native APIs', () => {
  const text = '"é😀বাংলা"';
  const bytes = Buffer.byteLength(text);
  assert.equal(api.stringifyJson(text, { maxBytes: bytes }), text);
  assert.deepEqual(api.stringifyJsonBatch([text], { maxBytes: bytes }), [text]);
  assert.equal(api.selectJson(text, '', { maxBytes: bytes }), text);
  for (const run of [
    () => api.stringifyJson(text, { maxBytes: bytes - 1 }),
    () => api.stringifyJsonBatch([text], { maxBytes: bytes - 1 }),
    () => api.selectJson(text, '', { maxBytes: bytes - 1 }),
  ]) assert.throws(run, error => error instanceof Error && error.code === 'InvalidArg' && /byte limit/.test(error.message));
});

test('readiness: prototype-like keys are data and escaped duplicate keys fail', () => {
  const text = '{"constructor":1,"__proto__":{"polluted":true},"prototype":2,"\\u0000":3}';
  const before = Object.getOwnPropertyDescriptor(Object.prototype, 'polluted');
  assert.equal(api.stringifyJson(text), '{"\\u0000":3,"__proto__":{"polluted":true},"constructor":1,"prototype":2}');
  assert.equal(api.selectJson(text, '/__proto__/polluted'), 'true');
  assert.deepEqual(Object.getOwnPropertyDescriptor(Object.prototype, 'polluted'), before);
  for (const text of ['{"😀":1,"\\ud83d\\ude00":2}', '{"\\u0000":1,"\\u0000":2}', '{"__proto__":1,"\\u005f_proto__":2}'])
    assert.throws(() => api.stringifyJson(text), /Duplicate decoded object key/);
});

test('readiness: deep invalid input fails without crashing an isolated process', () => {
  const script = `
    const assert = require('node:assert/strict');
    const api = require('./js/index.cjs');
    const input = '['.repeat(100000) + '0' + ']'.repeat(100000);
    for (const run of [() => api.stringifyJson(input), () => api.selectJson(input, '/0'), () => api.stringifyJsonBatch([input])])
      assert.throws(run, error => error instanceof Error && error.code === 'InvalidArg');
    for (const count of [1, 8, 64, 128]) {
      const valid = '['.repeat(count) + '0' + ']'.repeat(count);
      assert.equal(api.stringifyJson(valid, { maxDepth: count }), valid);
      if (count > 1) assert.throws(() => api.stringifyJson(valid, { maxDepth: count - 1 }), /nesting/);
    }
  `;
  const result = spawnSync(process.execPath, ['-e', script], { cwd: path.join(__dirname, '..'), encoding: 'utf8', timeout: 10000 });
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr);
});

test('readiness: compatibility imports survive failed native load and native retry works', () => {
  const script = `
    const assert = require('node:assert/strict');
    const Module = require('node:module');
    const original = Module._load;
    const sentinel = new Error('isolated missing native artifact');
    Module._load = function(request, ...args) {
      if (request === '../../native/binding.js') throw sentinel;
      return original.call(this, request, ...args);
    };
    const api = require('./js/index.cjs');
    assert.equal(api.stringify({ z: 1, a: 2 }), '{"a":2,"z":1}');
    assert.throws(() => api.stringifyJson('{}'), error => error === sentinel);
    Module._load = original;
    assert.equal(api.stringifyJson('{"b":1,"a":2}'), '{"a":2,"b":1}');
  `;
  const result = spawnSync(process.execPath, ['-e', script], { cwd: path.join(__dirname, '..'), encoding: 'utf8', timeout: 10000 });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
});

test('readiness: cache retries failed versions and handles external comparator state explicitly', () => {
  let reverse = false;
  let fail = false;
  const value = { get a() { if (fail) throw new Error('transient accessor'); return 1; }, b: 2 };
  const cache = api.createSerializerCache((a, b) => (reverse ? -1 : 1) * (a.key < b.key ? -1 : 1));
  assert.equal(cache.stringify(value, 0), '{"a":1,"b":2}');
  fail = true;
  assert.throws(() => cache.stringify(value, 1), /transient accessor/);
  fail = false;
  reverse = true;
  assert.equal(cache.stringify(value, 1), '{"b":2,"a":1}');
  reverse = false;
  // An unchanged version explicitly promises unchanged observable state.
  assert.equal(cache.stringify(value, 1), '{"b":2,"a":1}');
  assert.equal(cache.stringify(value, 2), '{"a":1,"b":2}');
});

test('readiness: native limit getters are read once and validated values are used', () => {
  const runners = [
    (input, options) => api.stringifyJson(input, options),
    (input, options) => api.stringifyJsonBatch([input], options),
    (input, options) => api.selectJson(input, '', options),
  ];
  for (const run of runners) {
    let depthReads = 0;
    const depthOptions = { get maxDepth() { return ++depthReads === 1 ? 1 : undefined; } };
    assert.throws(() => run('[[0]]', depthOptions), error => error instanceof Error && error.code === 'InvalidArg' && /nesting/.test(error.message));
    assert.equal(depthReads, 1);

    let byteReads = 0;
    const byteOptions = { get maxBytes() { return ++byteReads === 1 ? 1 : undefined; } };
    assert.throws(() => run('[0]', byteOptions), error => error instanceof Error && error.code === 'InvalidArg' && /byte limit/.test(error.message));
    assert.equal(byteReads, 1);

    const order = [];
    assert.throws(() => run('0', {
      get maxDepth() { order.push('depth'); return 0; },
      get maxBytes() { order.push('bytes'); throw new Error('must not read'); },
    }), RangeError);
    assert.deepEqual(order, ['depth']);

    const reads = [];
    run('[0]', {
      get maxDepth() { reads.push('depth'); return 1; },
      get maxBytes() { reads.push('bytes'); return 3; },
    });
    assert.deepEqual(reads, ['depth', 'bytes']);
  }
});
