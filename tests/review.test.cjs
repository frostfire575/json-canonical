'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const api = require('../js/index.cjs');
const upstream = require('../upstream/fast-json-stable-stringify');

function observe(serializer, factory) {
  const events = [];
  const [value, options] = factory(events);
  try { return { output: serializer(value, options), events }; }
  catch (error) { return { error: { name: error.name, message: error.message }, events }; }
}
function differential(factory) {
  assert.deepEqual(observe(api.stringify, factory), observe(upstream, factory));
}

test('review: comparator getter is captured twice, with upstream event order', () => {
  differential(events => {
    let reads = 0;
    const options = { get cmp() {
      events.push('cmp:get:' + ++reads);
      const direction = reads === 2 ? -1 : 1;
      return (a, b) => { events.push('cmp:call:' + reads); return direction * a.key.localeCompare(b.key); };
    }};
    return [{ z: 0, b: 1, a: 2 }, options];
  });
});

test('review: comparator invocation has upstream strict this receiver', () => {
  differential(events => [{ b: 1, a: 2 }, { cmp: function (a, b) {
    events.push(this === undefined ? 'unbound' : 'bound');
    return a.key.localeCompare(b.key);
  }}]);
});

test('review: comparator property mutation after capture does not replace function', () => {
  differential(events => {
    const options = { cmp(a, b) {
      events.push('original');
      options.cmp = () => { events.push('replacement'); return 1; };
      return a.key.localeCompare(b.key);
    }};
    return [{ d: 0, c: 1, b: 2, a: 3 }, options];
  });
});

test('review: abrupt comparator getter and getter/toJSON/proxy event traces', () => {
  const factories = [
    events => [{ a: 1 }, { get cmp() { events.push('get'); throw new RangeError('comparator getter'); } }],
    events => {
      let reads = 0;
      return [{ a: 1, b: 2 }, { get cmp() { events.push('get'); return ++reads === 1 ? (() => 0) : null; } }];
    },
    events => {
      const value = { get toJSON() { events.push('toJSON:get'); return function () { events.push('toJSON:call'); return { z: 1, a: 2 }; }; } };
      return [value];
    },
    events => {
      const value = new Proxy({ z: 1, a: 2 }, {
        ownKeys(target) { events.push('ownKeys'); return Reflect.ownKeys(target); },
        getOwnPropertyDescriptor(target, key) { events.push('descriptor:' + key); return Reflect.getOwnPropertyDescriptor(target, key); },
        get(target, key, receiver) { events.push('get:' + String(key)); return Reflect.get(target, key, receiver); }
      });
      return [value, (a, b) => a.key.localeCompare(b.key)];
    },
    events => {
      const value = { get a() { events.push('a'); delete this.b; this.c = 3; return 1; }, b: 2 };
      return [value];
    },
    events => {
      const value = [1, 2, 3];
      Object.defineProperty(value, '0', { get() { events.push('0'); value.length = 1; return 1; } });
      return [value];
    },
    events => [{ toJSON() { events.push('toJSON'); return undefined; } }],
    events => [{ toJSON() { events.push('toJSON'); throw new SyntaxError('toJSON failure'); } }],
    () => [{ boxed: Object(1n), bigint: 1n }],
    () => [{ sparse: Array(3), symbol: Symbol('x'), fn() {}, negzero: -0, infinity: Infinity }],
    () => { const shared = { x: 1 }; return [{ a: shared, b: shared }]; },
    () => { const cycle = { x: 1 }; cycle.self = cycle; return [cycle, { cycles: true }]; }
  ];
  for (const factory of factories) differential(factory);
});

test('review: array cycles preserve upstream errors in isolated child processes', () => {
  // Upstream does not track arrays. Keep stack exhaustion isolated from the runner.
  const root = path.resolve(__dirname, '..');
  for (const module of ['./js/index.cjs', './upstream/fast-json-stable-stringify']) {
    const script = `const m=require(${JSON.stringify(module)}); const f=m.stringify||m; const a=[];a[0]=a;try{f(a,{cycles:true});process.exitCode=2}catch(e){console.log(e.name)}`;
    const child = spawnSync(process.execPath, ['-e', script], { cwd: root, encoding: 'utf8', timeout: 10000 });
    assert.equal(child.status, 0, child.stderr);
    assert.equal(child.stdout.trim(), 'RangeError');
  }
});

test('review: upstream object key traversal ignores patched Array iterators', () => {
  const root = path.resolve(__dirname, '..');
  const script = `const a=require('./js/index.cjs').stringify; const b=require('./upstream/fast-json-stable-stringify'); const original=Array.prototype[Symbol.iterator]; let actual,expected;try{Array.prototype[Symbol.iterator]=function*(){for(let i=this.length-1;i>=0;i--)yield this[i]};actual=a({z:1,a:2});expected=b({z:1,a:2})}finally{Array.prototype[Symbol.iterator]=original} require('node:assert/strict').equal(actual,expected)`;
  const child = spawnSync(process.execPath, ['-e', script], { cwd: root, encoding: 'utf8', timeout: 10000 });
  assert.equal(child.status, 0, child.stderr);
});

test('review: native invalid JSON, escaped duplicate keys, UTF-16 sorting and token retention', () => {
  const malformed = ['', ' ', '\ufeff{}', '{} null', 'null\u0000', '[1,]', '{"x":01}', '{"x":NaN}', '"\u0001"', '"\\x00"', '"\\uZZZZ"', '{"a":1,"\\u0061":2}', '{"\\ud800":1}', '{"a": {"b":1,"b":2}}'];
  for (const input of malformed) assert.throws(() => api.stringifyJson(input), Error, JSON.stringify(input));
  assert.equal(api.stringifyJson('{"\ue000":0,"😀":1,"a":1.00,"b":-0,"c":1e999,"d":"\\ud800"}'), '{"a":1.00,"b":-0,"c":1e999,"d":"\\ud800","😀":1,"\ue000":0}');
  assert.equal(api.stringifyJson(' {"\\u0062":true,"a":[null,false,"\\/"]} '), '{"a":[null,false,"\\/"],"b":true}');
  assert.equal(api.stringifyJson('{"":1,"__proto__":2,"constructor":3}'), '{"":1,"__proto__":2,"constructor":3}');
});

test('review: native rejects lossy literal lone surrogate conversion, preserves escaped tokens', () => {
  // Reject before Node-API can replace an unpaired UTF-16 surrogate with U+FFFD.
  for (const code of [0xd800, 0xdbff, 0xdc00, 0xdfff]) {
    const input = '"' + String.fromCharCode(code) + '"';
    assert.throws(() => api.stringifyJson(input), /surrogate|well-formed/i);
    assert.throws(() => api.stringifyJsonBatch(['{}', input]), /surrogate|well-formed/i);
  }
  assert.equal(api.stringifyJson('"\\ud800"'), '"\\ud800"');
  assert.equal(api.stringifyJson('"😀"'), '"😀"');
});

test('review: native deep untrusted text errors without crashing the process', () => {
  const root = path.resolve(__dirname, '..');
  const script = `const {stringifyJson}=require('./js/index.cjs'); for(const n of [129,10000,100000]) {try {stringifyJson('['.repeat(n)+'0'+']'.repeat(n));process.exitCode=2} catch(e) {if(!(e instanceof Error))process.exitCode=3}}`;
  const child = spawnSync(process.execPath, ['-e', script], { cwd: root, encoding: 'utf8', timeout: 20000 });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.signal, null);
});

test('review: native depth and UTF-8 byte limits, option validation, atomic batch failures', () => {
  assert.equal(api.stringifyJson('[0]', { maxDepth: 1 }), '[0]');
  assert.throws(() => api.stringifyJson('[[0]]', { maxDepth: 1 }), /nesting/);
  assert.equal(api.stringifyJson('"é"', { maxBytes: 4 }), '"é"');
  assert.throws(() => api.stringifyJson('"é"', { maxBytes: 3 }), /byte limit/);
  for (const option of [0, -1, 0.5, NaN, Infinity, '1', null, 129, 2 ** 32 + 1])
    assert.throws(() => api.stringifyJson('{}', { maxDepth: option }), RangeError);
  for (const input of [null, 42, new String('{}'), {}, Buffer.from('{}')])
    assert.throws(() => api.stringifyJson(input), TypeError);
  assert.deepEqual(api.stringifyJsonBatch([]), []);
  assert.deepEqual(api.stringifyJsonBatch(['2', '{"b":1,"a":2}']), ['2', '{"a":2,"b":1}']);
  assert.throws(() => api.stringifyJsonBatch(['{}', '{']), /Batch item 1/);
  assert.throws(() => api.stringifyJsonBatch(Array(1025).fill('{}')), /1024/);
  assert.throws(() => api.stringifyJsonBatch([1]), TypeError);
});

test('review: cache versions, failed serialization, undefined results and invalidation', () => {
  const cache = api.createSerializerCache();
  let calls = 0;
  const value = { toJSON() { calls++; return undefined; } };
  assert.equal(cache.stringify(value, undefined), undefined);
  assert.equal(cache.stringify(value, undefined), undefined);
  assert.equal(calls, 1);
  assert.equal(cache.stringify(value, NaN), undefined);
  assert.equal(cache.stringify(value, NaN), undefined);
  assert.equal(calls, 2);
  cache.stringify(value, 0); cache.stringify(value, -0);
  assert.equal(calls, 4);
  assert.equal(cache.delete(value), true);
  assert.equal(cache.delete(value), false);
  cache.stringify(value, -0); cache.clear(); cache.stringify(value, -0);
  assert.equal(calls, 6);
  assert.throws(() => cache.stringify(value), /explicit version/);
  for (const invalid of [null, 1, 'x', Symbol('x')]) assert.throws(() => cache.stringify(invalid, 1), TypeError);
  const bad = { toJSON() { throw new Error('boom'); } };
  assert.throws(() => cache.stringify(bad, 1), /boom/);
  bad.toJSON = () => 3;
  assert.equal(cache.stringify(bad, 1), '3');
  assert.deepEqual(api.stringifyBatch(Array(3)), [undefined, undefined, undefined]);
  assert.throws(() => api.stringifyBatch({ 0: 1, length: 1 }), TypeError);
});
