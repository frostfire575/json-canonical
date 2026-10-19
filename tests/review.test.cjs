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

test('review scanner: 2000 seeded lexical documents preserve independently rendered tokens', () => {
  let state = 0x62ac789f;
  const random = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 0x100000000; };
  const pick = values => values[Math.floor(random() * values.length)];
  const whitespace = () => pick(['', ' ', '\t', '\r\n']);
  const leaves = ['null', 'true', 'false', '0', '-0', '-0.000', '1E+0002', '1e-9999', '1E9999', '123456789012345678901234567890.000001', '"\\ud800"', '"\\udc00"', '"\\u0061"', '"\\/"', '"😀বাংলা"', '"braces:{}[],colon: comma, quote:\\" slash:\\\\"'];
  const keys = ['', 'a', '😀', '\ue000', 'a/b', 'a"b', 'a\\b', '\u0000', '\t', '\n', 'বাংলা', '0', '01', '__proto__', 'constructor'];
  function make(depth) {
    if (depth > 3 || random() < 0.45) return { scalar: pick(leaves) };
    const length = Math.floor(random() * 5);
    if (random() < 0.45) return { array: Array.from({ length }, () => make(depth + 1)) };
    const selected = [...keys].sort(() => random() - 0.5).slice(0, length);
    return { object: selected.map(key => [key, make(depth + 1)]) };
  }
  function escapedKey(key) {
    // Deliberately alter source spelling without changing the decoded key.
    if (random() < 0.5) return JSON.stringify(key).replaceAll('/', '\\/');
    let token = '"';
    for (let i = 0; i < key.length; i++) token += '\\u' + key.charCodeAt(i).toString(16).padStart(4, '0');
    return token + '"';
  }
  function source(node) {
    if (node.scalar !== undefined) return node.scalar;
    if (node.array) return '[' + whitespace() + node.array.map(source).join(whitespace() + ',' + whitespace()) + whitespace() + ']';
    return '{' + whitespace() + node.object.map(([key, value]) => escapedKey(key) + whitespace() + ':' + whitespace() + source(value)).join(whitespace() + ',' + whitespace()) + whitespace() + '}';
  }
  function expected(node) {
    if (node.scalar !== undefined) return node.scalar;
    if (node.array) return '[' + node.array.map(expected).join(',') + ']';
    return '{' + [...node.object].sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0).map(([key, value]) => JSON.stringify(key) + ':' + expected(value)).join(',') + '}';
  }
  const inputs = [], outputs = [];
  for (let i = 0; i < 2000; i++) {
    const tree = make(0);
    const input = whitespace() + source(tree) + whitespace();
    const output = expected(tree);
    assert.equal(api.stringifyJson(input), output, 'case ' + i + ': ' + input);
    inputs.push(input); outputs.push(output);
  }
  // Exercise the same scanner through the single-boundary batch entry point.
  assert.deepEqual(api.stringifyJsonBatch(inputs.slice(0, 1024)), outputs.slice(0, 1024));
  assert.deepEqual(api.stringifyJsonBatch(inputs.slice(1024)), outputs.slice(1024));
});

test('review scanner: validator rejects malformed delimiters, escapes and numeric tokens first', () => {
  for (const input of [
    '{"x" 1}', '{"x":}', '{"x":1,}', '{,"x":1}', '{"x":1 "y":2}', '{"x":1]',
    '[1 2]', '[,1]', '[1,,2]', '[1}', '[[0]}', 'truefalse', 'null:', '1:2', '+1', '.1', '1.', '1e', '1e+', '--1', '00',
    '{"x":"\\"}', '"\\u000"', '"\\u00g0"', '"\\q"', '"\\uD800x" garbage',
    '{"x":\v1}', '\fnull', '\u00a0null', '"unescaped\nnewline"'
  ]) assert.throws(() => api.stringifyJson(input), Error, JSON.stringify(input));
  for (const key of ['a', 'a/b', '😀', '\u0000', 'a"b', 'a\\b']) {
    let escaped = '"';
    for (let i = 0; i < key.length; i++) escaped += '\\u' + key.charCodeAt(i).toString(16).padStart(4, '0');
    escaped += '"';
    assert.throws(() => api.stringifyJson('{' + JSON.stringify(key) + ':0,' + escaped + ':1}'), /Duplicate decoded/);
  }
});

test('review scanner: depth limits count empty and mixed object/array containers in every branch', () => {
  const branches = [
    (value, level) => '[' + value + ']',
    (value, level) => '{"z":0,"a":' + value + '}',
    (value, level) => level % 2 ? '{"z":0,"a":' + value + '}' : '[false,' + value + ',true]'
  ];
  for (const branch of branches) {
    for (const maxDepth of [1, 2, 8, 64, 128]) {
      let text = '0';
      for (let i = 0; i < maxDepth; i++) text = branch(text, i);
      assert.doesNotThrow(() => api.stringifyJson(text, { maxDepth }));
      assert.throws(() => api.stringifyJson(branch(text, maxDepth), { maxDepth }), /nesting/);
    }
  }
  assert.equal(api.stringifyJson('{"a":[],"b":{}}', { maxDepth: 2 }), '{"a":[],"b":{}}');
  assert.throws(() => api.stringifyJson('{"a":[],"b":{}}', { maxDepth: 1 }), /nesting/);
});

test('review selection: 3500 seeded raw-token and pointer cases match independent AST traversal', () => {
  let state = 0xdca619f2;
  const random = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 0x100000000; };
  const pick = values => values[Math.floor(random() * values.length)];
  const keys = ['', '/', '~', '~1', '~01', 'a/b~c', '😀', '\ue000', 'বাংলা', 'e\u0301', 'é', '\u0000', '__proto__', 'constructor', '0', '00', '01', 'length'];
  const leaves = ['null', 'true', 'false', '-0', '0.00', '1e+002', '42', '"\\ud800"', '"\\/"', '"commas, braces{}[] quotes\\" slash\\\\"'];
  function make(depth) {
    if (depth > 4 || random() < 0.4) return { text: pick(leaves), kind: 'scalar' };
    const children = Array.from({ length: Math.floor(random() * 5) }, () => make(depth + 1));
    if (random() < 0.5) return { text: '[ ' + children.map(child => child.text).join(' ,\n') + ' ]', kind: 'array', children };
    const entries = children.map(child => [pick(keys), child]);
    const text = '{\n' + entries.map(([key, child]) => {
      const token = random() < 0.5 ? JSON.stringify(key).replaceAll('/', '\\/') : '"' + Array.from({ length: key.length }, (_, i) => '\\u' + key.charCodeAt(i).toString(16).padStart(4, '0')).join('') + '"';
      return token + ' : ' + child.text;
    }).join(' , ') + '\n}';
    return { text, kind: 'object', entries };
  }
  function resolve(node, segments) {
    for (const segment of segments) {
      if (node.kind === 'array') {
        if (!/^(0|[1-9][0-9]*)$/.test(segment) || Number(segment) >= node.children.length) return undefined;
        node = node.children[Number(segment)];
      } else if (node.kind === 'object') {
        const entry = node.entries.findLast(([key]) => key === segment);
        if (!entry) return undefined;
        node = entry[1];
      } else return undefined;
    }
    return node.text;
  }
  function parsedSelection(input, segments) {
    let value = JSON.parse(input);
    for (const segment of segments) {
      if (value === null || typeof value !== 'object') return undefined;
      if (Array.isArray(value) && !/^(0|[1-9][0-9]*)$/.test(segment)) return undefined;
      if (!Object.hasOwn(value, segment)) return undefined;
      value = value[segment];
    }
    return value;
  }
  for (let i = 0; i < 3500; i++) {
    const tree = make(0);
    const segments = [];
    let current = tree;
    while (random() < 0.7 && segments.length < 7) {
      if (current?.kind === 'object' && current.entries.length && random() < 0.8) {
        const key = pick(current.entries)[0];
        segments.push(key);
        current = current.entries.findLast(entry => entry[0] === key)[1];
      } else if (current?.kind === 'array' && current.children.length && random() < 0.8) {
        const index = Math.floor(random() * current.children.length);
        segments.push(String(index)); current = current.children[index];
      } else {
        segments.push(pick([...keys, 'missing', '-1', '999999999999999999999999999999']));
        current = undefined;
      }
    }
    const pointer = segments.length ? '/' + segments.map(segment => segment.replaceAll('~', '~0').replaceAll('/', '~1')).join('/') : '';
    const actual = api.selectJson('\r\n' + tree.text + '\t', pointer);
    assert.equal(actual, resolve(tree, segments), 'case ' + i + ': ' + pointer + ' from ' + tree.text);
    assert.deepEqual(actual === undefined ? undefined : JSON.parse(actual), parsedSelection(tree.text, segments));
  }
});

test('review selection: duplicates, array index grammar, missing/null and lexical preservation', () => {
  const input = '{"a":{"x":1},"\\u0061":{"x":null},"zero":-0.000,"huge":1E9999,"precision":123456789012345678901234567890.0001,"raw":"\\ud800"}';
  assert.equal(api.selectJson(input, '/a/x'), 'null');
  assert.equal(api.selectJson(input, '/a/missing'), undefined);
  assert.equal(api.selectJson(input, '/a/x/further'), undefined);
  assert.equal(api.selectJson(input, '/zero'), '-0.000');
  assert.equal(api.selectJson(input, '/huge'), '1E9999');
  assert.equal(api.selectJson(input, '/precision'), '123456789012345678901234567890.0001');
  assert.equal(api.selectJson(input, '/raw'), '"\\ud800"');
  for (const pointer of ['/00', '/01', '/+0', '/-0', '/-1', '/1.0', '/1e0', '/١', '/length', '/constructor', '/__proto__', '/', '/18446744073709551616'])
    assert.equal(api.selectJson('[0,1]', pointer), undefined, pointer);
  assert.equal(api.selectJson('{"00":1,"-0":2,"length":3,"__proto__":4}', '/00'), '1');
  assert.equal(api.selectJson('{"00":1,"-0":2,"length":3,"__proto__":4}', '/__proto__'), '4');
  for (const invalid of ['/~', '/~2', '/~~0', '/~10~9', '#/x', 'x'])
    assert.throws(() => api.selectJson('{}', invalid), RangeError);
  assert.equal(api.selectJson('{"~1":1,"/":2,"~01":3}', '/~01'), '1');
  assert.equal(api.selectJson('{"~1":1,"/":2,"~01":3}', '/~1'), '2');
  assert.equal(api.selectJson('{"~1":1,"/":2,"~01":3}', '/~001'), '3');
  assert.equal(api.selectJson(' { "x": [ 1, 2 ] } ', ''), '{ "x": [ 1, 2 ] }');
});

test('review selection: validates unselected siblings/depth, ignores structural text inside strings', () => {
  const deep = '{"selected":1,"other":' + '['.repeat(128) + '0' + ']'.repeat(128) + '}';
  for (const pointer of ['/selected', '/missing', '']) assert.throws(() => api.selectJson(deep, pointer), /nesting/);
  for (const input of ['{"selected":1,"other":[0,]}', '{"selected":1,"other":"\\x00"}', '{"selected":1,"other":1e}', '{"selected":1} garbage'])
    for (const pointer of ['/selected', '/missing', '']) assert.throws(() => api.selectJson(input, pointer), Error);
  const braces = JSON.stringify({ selected: '[[[[{{{{}}}}]]]]', other: 'quotes" backslash\\ unicode😀' });
  assert.equal(api.selectJson(braces, '/selected', { maxDepth: 1 }), '"[[[[{{{{}}}}]]]]"');
  const values = Array.from({ length: 20000 }, (_, i) => ({ index: i, payload: '[{}]\\"' }));
  const large = JSON.stringify(values);
  assert.equal(api.selectJson(large, '/19999/index'), '19999');
  assert.equal(api.selectJson(large, '/20000'), undefined);
  assert.throws(() => api.selectJson(large, '/0', { maxBytes: 100 }), /byte limit/);
  assert.throws(() => api.selectJson('{}', '/' + 'é'.repeat(32768)), /64 KiB/);
  assert.throws(() => api.selectJson('{}', '/'.repeat(129)), /128 segments/);
  for (const input of [null, 1, Buffer.from('{}')]) assert.throws(() => api.selectJson(input, ''), TypeError);
  for (const pointer of [null, 1, [], '/\ud800']) assert.throws(() => api.selectJson('{}', pointer), TypeError);
});

test('review selection: visited object keys require Unicode scalar strings, raw subtrees remain text', () => {
  const input = '{"a":1,"\\ud800":2}';
  assert.equal(api.selectJson(input, ''), input);
  assert.throws(() => api.selectJson(input, '/a'), error => error instanceof Error && error.code === 'InvalidArg');
  const nested = '{"a":1,"other":{"\\ud800":2}}';
  assert.equal(api.selectJson(nested, '/a'), '1');
  assert.equal(api.selectJson(nested, '/other'), '{"\\ud800":2}');
  assert.throws(() => api.selectJson(nested, '/other/missing'), error => error instanceof Error && error.code === 'InvalidArg');
});
