'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const path = require('node:path');
const api = require('../js/index.cjs');
const oracle = require('../upstream/fast-json-stable-stringify');

test('all unmodified upstream assertions execute against our public API', () => {
  let assertions = 0;
  for (const filename of fs.readdirSync(path.join(__dirname, '../upstream/fast-json-stable-stringify/test'))) {
    const file = path.join(__dirname, '../upstream/fast-json-stable-stringify/test', filename);
    const localRequire = createRequire(file);
    const tape = (name, run) => {
      let planned = 0, actual = 0;
      run({ plan(n) { planned = n; }, equal(a, b) { assert.equal(a, b, name); actual++; assertions++; } });
      assert.equal(actual, planned, `upstream assertion plan: ${name}`);
    };
    vm.runInNewContext(fs.readFileSync(file, 'utf8'), {
      require(id) { return id === 'tape' ? tape : id === '../' ? api.stringify : localRequire(id); },
    }, { filename: file });
  }
  assert.equal(assertions, 16);
});

function outcome(fn) {
  try { return { value: fn() }; }
  catch (error) { return { error: error.constructor.name, message: error instanceof RangeError ? '<stack limit>' : error.message }; }
}
function compare(value, options) {
  assert.deepEqual(outcome(() => api.stringify(value, options)), outcome(() => oracle(value, options)));
}
test('edge values, Unicode, boxed values, numbers, unsupported values', () => {
  const values = [undefined, null, true, false, '', '\ud800\udfff\ud800', '\u0000\n\r\t',
    Symbol('s'), function f() {}, NaN, Infinity, -Infinity, -0, 5e-324, 1e-7, 1e21, 1e20,
    9007199254740991, 1000000000000000100, 1n, new Number(2), new String('x'), new Boolean(false),
    new Date('2020-01-01'), new Date(NaN), /x/, new Map([['x', 1]]), new Set([1]),
    Object.create(null), { '\ue000': 1, '\u{10000}': 2, '10': 3, '2': 4, '\ud800': 5 },
    [undefined, , Symbol('s'), function() {}, NaN], { a: undefined, b: Symbol(), c() {} }];
  for (const value of values) compare(value);
  assert.equal(api.stableStringify, api.stringify);
});
test('cycles, repeated references and upstream array-cycle behavior', () => {
  const object = { a: 1 }; object.self = object;
  compare(object); compare(object, { cycles: true }); compare(object, { cycles: 'true' });
  compare({ a: object, b: object }, { cycles: true });
  const repeated = { z: 1, a: 2 }; compare([repeated, repeated]);
  const array = []; array.push(array);
  compare(array); compare(array, { cycles: true });
});
test('factory-based observable property/comparator/toJSON events', () => {
  const factories = [
    log => ({ b: { toJSON(...args) { log.push(['toJSON', args.length, this === value.b]); return 1; } }, a: 2 }),
    log => Object.defineProperties({}, {
      b: { enumerable: true, get() { log.push('b'); return 2; } },
      a: { enumerable: true, get() { log.push('a'); return 1; } }
    }),
    log => new Proxy({ z: 1, a: 2 }, {
      get(target, key) { log.push(['get', String(key)]); return target[key]; },
      ownKeys(target) { log.push('ownKeys'); return Reflect.ownKeys(target); },
      getOwnPropertyDescriptor(target, key) { log.push(['descriptor', key]); return Reflect.getOwnPropertyDescriptor(target, key); }
    }),
    log => ({ get toJSON() { log.push('toJSON-get'); return function() { log.push('call'); return { z: 1, a: 2 }; }; } }),
    log => ({ a: { toJSON() { log.push('throw'); throw new Error('sentinel'); } } }),
  ];
  let value;
  for (const factory of factories) {
    for (const useComparator of [false, true]) {
      function run(fn) {
        const log = []; value = factory(log);
        const options = useComparator ? function(a, b) {
          const observed = entry => [entry.key, typeof entry.value === 'object' && entry.value !== null ? '<object>' : entry.value];
          log.push(['cmp', observed(a), observed(b), this]);
          return a.key < b.key ? 1 : -1;
        } : undefined;
        return { result: outcome(() => fn(value, options)), log };
      }
      assert.deepEqual(run(api.stringify), run(oracle));
    }
  }
});

test('6000 deterministic generated exact-output oracle cases', () => {
  let state = 0xc0ffee;
  const random = n => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) % n; };
  const keys = ['x', 'a', '2', '10', '😀', '\ue000', '\ud800', 'quote"', '\u0000', '__proto__'];
  function generate(depth) {
    const kind = random(depth ? 9 : 6);
    if (kind === 0) return undefined;
    if (kind === 1) return null;
    if (kind === 2) return Boolean(random(2));
    if (kind === 3) return [NaN, Infinity, -0, 1e-7, 1e21, random(100000) / 17][random(6)];
    if (kind === 4) return keys[random(keys.length)].repeat(random(4));
    if (kind === 5) return random(2) ? Symbol('s') : function() {};
    if (kind === 6) return Array.from({ length: random(8) }, () => generate(depth - 1));
    const object = Object.create(null);
    for (let i = 0, n = random(8); i < n; i++) object[keys[random(keys.length)]] = generate(depth - 1);
    return object;
  }
  for (let i = 0; i < 6000; i++) {
    const value = generate(4);
    compare(value, i % 3 === 0 ? (a, b) => a.key < b.key ? 1 : a.key > b.key ? -1 : 0 : undefined);
  }
});
