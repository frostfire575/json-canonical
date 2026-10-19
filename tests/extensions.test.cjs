'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { stringify, stringifyBatch, createSerializerCache } = require('../js/index.cjs');
test('ordered compatibility batch, unsupported values and errors', () => {
  const values = [{ b: 2, a: 1 }, undefined, , [undefined], 4];
  assert.deepEqual(stringifyBatch(values), Array.from(values, x => stringify(x)));
  assert.throws(() => stringifyBatch({}), TypeError);
  assert.throws(() => stringifyBatch([{}, 1n]), TypeError);
});
test('explicit version cache invalidation, clear, delete and option behavior', () => {
  const cache = createSerializerCache();
  const value = { a: 1 };
  assert.throws(() => cache.stringify(value), /explicit version/);
  assert.throws(() => cache.stringify(null, 1), /objects/);
  assert.equal(cache.stringify(value, 1), '{"a":1}');
  value.a = 2;
  assert.equal(cache.stringify(value, 2), '{"a":2}');
  value.a = 3;
  assert.equal(cache.delete(value), true);
  assert.equal(cache.stringify(value, 2), '{"a":3}');
  value.a = 4; cache.clear();
  assert.equal(cache.stringify(value, 2), '{"a":4}');
  const custom = createSerializerCache((a, b) => a.key < b.key ? 1 : -1);
  assert.equal(custom.stringify({ a: 1, b: 2 }, undefined), '{"b":2,"a":1}');
});
test('cache hits skip traversal; exceptions never poison entries', () => {
  let calls = 0;
  const value = { toJSON() { calls++; return undefined; } };
  const cache = createSerializerCache();
  assert.equal(cache.stringify(value, 1), undefined);
  assert.equal(cache.stringify(value, 1), undefined);
  assert.equal(calls, 1);
  const cyclic = {}; cyclic.self = cyclic;
  assert.throws(() => cache.stringify(cyclic, 1), TypeError);
  delete cyclic.self;
  assert.equal(cache.stringify(cyclic, 1), '{}');
});
