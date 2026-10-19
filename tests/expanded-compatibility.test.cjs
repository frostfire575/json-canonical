'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const api = require('../js/index.cjs');
const oracle = require('../upstream/fast-json-stable-stringify');

// Recreate stateful fixtures separately: serializing the same mutable input twice
// can conceal differences in getter, comparator and toJSON observation order.
function observe(serializer, factory) {
  const events = [];
  const [value, options] = factory(events);
  try { return { output: serializer(value, options), events }; }
  catch (error) { return { error: { name: error.name, message: error.message }, events }; }
}
function differential(factory) {
  assert.deepEqual(observe(api.stringify, factory), observe(oracle, factory));
}
function randomGenerator(seed) {
  let state = seed;
  return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return state >>> 0; };
}

test('expanded: 8192 seeded IEEE-754 bit patterns retain exact V8 number spelling', () => {
  const random = randomGenerator(0x4d97ab13);
  const bytes = Buffer.alloc(8);
  const explicit = [-0, 0, NaN, Infinity, -Infinity, Number.MIN_VALUE, Number.MAX_VALUE,
    Number.EPSILON, 1e-7, 1e-6, 1e20, 1e21, 1000000000000000100,
    2 ** 53 - 1, 2 ** 53, 2 ** -1022, (2 ** -1022) - Number.MIN_VALUE];
  for (const value of explicit) assert.equal(api.stringify(value), oracle(value));
  for (let i = 0; i < 8192; i++) {
    bytes.writeUInt32LE(random(), 0); bytes.writeUInt32LE(random(), 4);
    const value = bytes.readDoubleLE();
    assert.equal(api.stringify(value), oracle(value), `IEEE case ${i}: ${bytes.toString('hex')}`);
  }
  assert.equal(api.stringify({ numbers: explicit }), oracle({ numbers: explicit }));
});

test('expanded: 2048 seeded arbitrary UTF-16 strings, keys and surrogate boundaries', () => {
  const random = randomGenerator(0x71c58f21);
  const units = [0, 8, 9, 10, 13, 31, 32, 34, 47, 92, 0x301, 0x9ac,
    0x2028, 0x2029, 0xd7ff, 0xd800, 0xdbff, 0xdc00, 0xdfff, 0xe000, 0xffff];
  for (let i = 0; i < 2048; i++) {
    let text = '';
    for (let j = 0, n = random() % 18; j < n; j++) {
      text += String.fromCharCode(random() % 3 === 0 ? random() & 0xffff : units[random() % units.length]);
    }
    const value = Object.assign(Object.create(null), { [text]: [text, { z: text, a: '\ud800\udc00' }] });
    assert.equal(api.stringify(value), oracle(value), `UTF-16 case ${i}`);
    // Scalar tokens containing escaped lone surrogates are explicitly supported
    // by the native API; keys must be well-formed Unicode scalar strings.
    assert.equal(api.stringifyJson(JSON.stringify([text])), oracle([text]));
    if (text.isWellFormed()) assert.equal(api.stringifyJson(JSON.stringify(value)), oracle(value));
    else assert.throws(() => api.stringifyJson(JSON.stringify(value)),
      error => error instanceof Error && error.code === 'InvalidArg');
  }
});

test('expanded: inherited toJSON, three accessor reads, receiver, and returned object behavior', () => {
  differential(events => {
    const original = Object.create({ toJSON(...args) {
      events.push(['inherited', args.length, this === original]);
      return { z: undefined, a: 42 };
    } });
    return [{ wrapped: original }];
  });
  differential(events => {
    let reads = 0;
    const value = { get toJSON() {
      const id = ++reads; events.push(['get', id]);
      return function(...args) { events.push(['call', id, this === value, args.length]); return 7; };
    } };
    return [value];
  });
  differential(events => [{ toJSON() {
    events.push('outer');
    return { toJSON() { events.push('returned-toJSON'); return 99; }, x: 1 };
  } }]);
  differential(events => {
    let reads = 0;
    return [{ get toJSON() {
      events.push(++reads);
      // Third property access resolves the call target; preserve TypeError too.
      return reads === 3 ? null : () => 1;
    } }];
  });
});

test('expanded: getter deletion/addition, snapshot keys and array length mutation', () => {
  differential(events => {
    const value = { get a() {
      events.push('get:a'); delete value.z; value.b = 3; return 1;
    }, z: 2 };
    return [value];
  });
  differential(events => {
    const value = [0, 1, 2];
    Object.defineProperty(value, 0, { get() { events.push('first'); value.length = 1; return 0; } });
    return [value];
  });
  differential(events => {
    const value = [0];
    Object.defineProperty(value, 0, { get() { events.push('grow'); value.push(1, 2); return 0; } });
    return [value];
  });
  differential(events => {
    const prototype = { 1: 'inherited', missing: 1 };
    const value = [0, , 2]; Object.setPrototypeOf(value, prototype);
    events.push(Array.isArray(value)); return [value];
  });
});

test('expanded: comparators mutate values/keys, stable ties and throwing getters', () => {
  differential(events => {
    const value = { z: 3, c: 2, b: 1, a: 0 };
    let first = true;
    return [value, (a, b) => {
      events.push([a.key, a.value, b.key, b.value]);
      if (first) { first = false; delete value.b; value.zz = 99; value.a = 10; }
      return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    }];
  });
  differential(events => [{ z: 3, '10': 10, '2': 2, b: 1 }, (a, b) => {
    events.push([a.key, b.key]); return 0;
  }]);
  differential(events => [Object.defineProperties({}, {
    z: { enumerable: true, get() { events.push('get:z'); throw new SyntaxError('comparator property sentinel'); } },
    a: { enumerable: true, value: 1 },
  }), (a, b) => 0]);
  differential(events => [{ z: 3, a: 1 }, () => { events.push('cmp:throw'); throw new URIError('cmp sentinel'); }]);
  for (const cmp of [true, 1, 'cmp', {}, Symbol('cmp')]) differential(() => [{ b: 1, a: 2 }, { cmp }]);
});

test('expanded: revoked proxies, ownKeys violations and non-Error throws are preserved', () => {
  differential(() => {
    const { proxy, revoke } = Proxy.revocable({}, {}); revoke(); return [proxy];
  });
  differential(events => [new Proxy({ a: 1 }, {
    ownKeys() { events.push('ownKeys'); return ['a', 'a']; },
  })]);
  for (const thrown of [null, undefined, 7, 'sentinel', Symbol.for('sentinel')]) {
    function run(serializer) {
      let caught = false, result;
      try { serializer({ get a() { throw thrown; } }); }
      catch (error) { caught = true; result = error; }
      return [caught, result];
    }
    assert.deepEqual(run(api.stringify), run(oracle));
  }
});

test('expanded: mixed cycles, repeated graph references and toJSON cycle creation/removal', () => {
  for (const cycles of [undefined, false, true]) {
    differential(() => {
      const root = { z: 1 }, child = { x: root };
      root.a = [child, child]; root.b = child; return [root, { cycles }];
    });
    differential(events => {
      const value = { z: 1, toJSON() { events.push('toJSON'); delete this.toJSON; this.self = this; return this; } };
      return [value, { cycles }];
    });
    differential(events => {
      const value = { toJSON() { events.push('break-cycle'); return { a: 1 }; } }; value.self = value;
      return [value, { cycles }];
    });
  }
  differential(() => {
    const common = Object.freeze({ z: [1, 2, 3], a: 'shared' });
    return [{ b: [common, common], a: { one: common, two: common } }];
  });
});

test('expanded: 1000 seeded nested graphs with shared children and custom comparators', () => {
  const random = randomGenerator(0xaebc9132);
  const names = ['z', 'a', '10', '2', '\u0000', '__proto__', 'constructor', '\ud800', '😀', 'é', 'e\u0301'];
  function make(depth, pool) {
    const kind = random() % (depth ? 8 : 5);
    if (kind === 0) return names[random() % names.length];
    if (kind === 1) return [undefined, null, false, NaN, Infinity, -0, 1e21][random() % 7];
    if (kind === 2) return random() / 13;
    if (kind === 3) return pool.length ? pool[random() % pool.length] : null;
    if (kind === 4) return random() % 2 ? function() {} : Symbol('s');
    // Add completed objects only: these are repeated references, not cycles.
    const value = kind === 5 ? [] : Object.create(null);
    for (let i = 0, n = random() % 6; i < n; i++) {
      if (Array.isArray(value)) value.push(make(depth - 1, pool));
      else value[names[random() % names.length]] = make(depth - 1, pool);
    }
    pool.push(value); return value;
  }
  for (let i = 0; i < 1000; i++) {
    const value = make(5, []);
    const options = i % 2 ? undefined : (a, b) => a.key > b.key ? -1 : a.key < b.key ? 1 : 0;
    assert.equal(api.stringify(value, options), oracle(value, options), `nested graph case ${i}`);
  }
});

test('expanded: 30000 records and 40000-key object exact output through public and native APIs', () => {
  const values = Array.from({ length: 30000 }, (_, i) => ({ z: i / 17, a: ['বাংলা😀', i, null], optional: i % 3 ? undefined : false }));
  const expectedArray = oracle(values);
  assert.equal(api.stringify(values), expectedArray);
  assert.equal(api.stringifyJson(JSON.stringify(values)), expectedArray);
  const wide = Object.create(null);
  for (let i = 40000; i > 0; i--) wide[`key-${i.toString().padStart(5, '0')}-😀`] = i;
  const expectedWide = oracle(wide);
  assert.equal(api.stringify(wide), expectedWide);
  assert.equal(api.stringifyJson(JSON.stringify(wide)), expectedWide);
});

test('expanded: process-isolated intrinsic hooks and array cycles preserve upstream outcomes', () => {
  const script = `
    'use strict';
    const assert = require('node:assert/strict');
    const api = require('./js/index.cjs');
    const oracle = require('./upstream/fast-json-stable-stringify');
    const keys = Object.keys, finite = global.isFinite, stringify = JSON.stringify;
    function run(fn) {
      const events = [];
      Object.keys = value => { events.push('keys'); return keys(value).reverse(); };
      global.isFinite = value => { events.push(['finite', value]); return finite(value); };
      JSON.stringify = value => { events.push(['json', typeof value]); return stringify(value); };
      try { return { value: fn({ b: 3, a: ['x', NaN, 2] }), events }; }
      finally { Object.keys = keys; global.isFinite = finite; JSON.stringify = stringify; }
    }
    assert.deepEqual(run(api.stringify), run(oracle));
    for (const cycles of [false, true]) {
      function cycleResult(fn) { const value=[]; value.push(value); try { fn(value,{cycles}); return 'returned'; } catch(e) { return e.name; } }
      assert.equal(cycleResult(api.stringify), 'RangeError');
      assert.equal(cycleResult(api.stringify), cycleResult(oracle));
    }
  `;
  const child = spawnSync(process.execPath, ['-e', script], {
    cwd: path.resolve(__dirname, '..'), encoding: 'utf8', timeout: 20000,
  });
  assert.equal(child.status, 0, child.stderr || child.error?.message);
  assert.equal(child.signal, null);
});
