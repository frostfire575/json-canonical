'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const json = require('..');
const { JsonError } = json;

const code = (c) => (error) => error instanceof JsonError && error.code === c;

test('RFC 8785 section 3.2.4 example', () => {
  const input = `{
    "numbers": [333333333.33333329, 1E30, 4.50,
                2e-3, 0.000000000000000000000000001],
    "string": "\\u20ac$\\u000F\\u000aA'\\u0042\\u0022\\u005c\\\\\\"\\/",
    "literals": [null, true, false]
  }`;
  assert.equal(json.canonicalize(input),
    '{"literals":[null,true,false],"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27],"string":"€$\\u000f\\nA\'B\\"\\\\\\\\\\"/"}');
});

test('canonicalize rejects what I-JSON forbids', () => {
  assert.throws(() => json.canonicalize('{"a":1,"a":2}'), code('ERR_JSON_DUPLICATE_KEY'));
  assert.throws(() => json.canonicalize('"\\udead"'), code('ERR_JSON_LONE_SURROGATE'));
  assert.throws(() => json.canonicalize('[1e999]'), code('ERR_JSON_NUMBER_RANGE'));
  assert.throws(() => json.canonicalize('9007199254740993', { strictNumbers: true }), code('ERR_JSON_PRECISION'));
  assert.equal(json.canonicalize('9007199254740993'), '9007199254740992');
});

test('sortKeys preserves what JSON.parse would lose', () => {
  assert.equal(json.sortKeys('{"id":12345678901234567890,"price":1.10,"b":{"y":"\\u00e9","x":-0}}'),
    '{"b":{"x":-0,"y":"\\u00e9"},"id":12345678901234567890,"price":1.10}');
  assert.equal(json.sortKeys('{"2":0,"10":0,"a":0}'), '{"10":0,"2":0,"a":0}', 'string order, not integer-key order');
  assert.throws(() => json.sortKeys('{"a":1,"\\u0061":2}'), code('ERR_JSON_DUPLICATE_KEY'));
  assert.equal(json.minify('{ "b" : [ 1 , 2 ] , "a" : 1.0 }'), '{"b":[1,2],"a":1.0}');
});

test('errors carry code, byte offset, line and UTF-16 column', () => {
  const text = '{\n  "😀": [1,,2]\n}';
  assert.throws(() => json.validate(text), (e) => {
    assert.ok(e instanceof SyntaxError && e instanceof JsonError);
    assert.equal(e.name, 'JsonError');
    assert.equal(e.code, 'ERR_JSON_SYNTAX');
    assert.deepEqual([e.line, e.column, e.offset], [2, 12, Buffer.byteLength('{\n  "😀": [1,')]);
    assert.match(e.message, /line 2 column 12/);
    return true;
  });
  assert.throws(() => json.validate(''), code('ERR_JSON_SYNTAX'));
  assert.throws(() => json.validate('[[1]]', { maxDepth: 1 }), code('ERR_JSON_DEPTH'));
  assert.throws(() => json.validate('[1,2]', { maxBytes: 4 }), code('ERR_JSON_SIZE'));
  assert.throws(() => json.validate(Buffer.from([0x22, 0xff, 0x22])), (e) => e.code === 'ERR_JSON_ENCODING' && e.offset === 1);
  assert.throws(() => json.canonicalize('"a\ud800"'), (e) => e.code === 'ERR_JSON_ENCODING' && e.column === 3);
  assert.equal(json.isValid('{"a":[]}'), true);
  assert.equal(json.isValid('{"a":[}'), false);
  assert.throws(() => json.equal('1', '[', {}), (e) => e.argument === 1);
});

test('argument validation', () => {
  assert.throws(() => json.canonicalize(42), TypeError);
  assert.throws(() => json.canonicalize('1', null), TypeError);
  assert.throws(() => json.canonicalize('1', { maxDepth: 0 }), RangeError);
  assert.throws(() => json.canonicalize('1', { maxDepth: 1.5 }), RangeError);
  assert.throws(() => json.canonicalize('1', { maxBytes: 2 ** 30 + 1 }), RangeError);
  assert.throws(() => json.canonicalize('1', { strictNumbers: 'yes' }), TypeError);
  assert.throws(() => json.canonicalize('1', { output: 'array' }), TypeError);
  assert.throws(() => json.select('{}', 'a'), RangeError);
  assert.throws(() => json.select('{}', '/~2'), RangeError);
  assert.equal(json.canonicalize('[1]', { maxDepth: 1024, maxBytes: 2 ** 30 }), '[1]');
});

test('bytes in, bytes out', () => {
  const bytes = new TextEncoder().encode(' {"b":"é","a":1} ');
  const out = json.canonicalize(bytes, { output: 'buffer' });
  assert.ok(Buffer.isBuffer(out));
  assert.equal(out.toString(), '{"a":1,"b":"é"}');
  const view = new Uint8Array(bytes.buffer, 1, bytes.length - 2);
  assert.equal(json.sortKeys(view), '{"a":1,"b":"é"}');
  assert.equal(json.minify(Buffer.from('[ ]'), { output: 'buffer' }).toString(), '[]');
});

test('async variants run off-thread and reject with JsonError', async () => {
  const big = JSON.stringify(Array.from({ length: 20000 }, (_, i) => ({ z: i, a: [i / 3, 'x'.repeat(i % 7)] })));
  const [a, b, c] = await Promise.all([json.canonicalizeAsync(big), json.sortKeysAsync(Buffer.from(big), { output: 'buffer' }), json.minifyAsync(big)]);
  assert.equal(a, json.canonicalize(big));
  assert.equal(b.toString(), json.sortKeys(big));
  assert.equal(c, big);
  await assert.rejects(json.canonicalizeAsync('{"a":}'), code('ERR_JSON_SYNTAX'));
  await assert.rejects(json.canonicalizeAsync(1), TypeError);
  const buffer = Buffer.from('[1,2,3]');
  const pending = json.minifyAsync(buffer);
  buffer.fill(0x20);
  assert.equal(await pending, '[1,2,3]', 'input is copied before the worker starts');
});

test('equal and canonicalHash', () => {
  assert.equal(json.equal('{"a":[1.0,"\\u0041"],"b":null}', ' {"b":null,"a":[1,"A"]}'), true);
  assert.equal(json.equal('{"a":1}', '{"a":2}'), false);
  const expected = createHash('sha256').update('{"a":1,"b":[true]}').digest('hex');
  assert.equal(json.canonicalHash(' {"b":[true],"a":1.0} '), expected);
  assert.equal(json.canonicalHash('{}', { algorithm: 'sha512', encoding: 'base64' }), createHash('sha512').update('{}').digest('base64'));
});

test('select returns raw text', () => {
  const doc = Buffer.from('{"users":[{"name":"Ada","tags":[ 1, 2 ]}],"a/b":{"~":true},"":5}');
  assert.equal(json.select(doc, '/users/0/name'), '"Ada"');
  assert.equal(json.select(doc, '/users/0/tags'), '[ 1, 2 ]');
  assert.equal(json.select(doc, '/a~1b/~0'), 'true');
  assert.equal(json.select(doc, '/'), '5');
  assert.equal(json.select(doc, '/users/1'), undefined);
  assert.equal(json.select(doc, '/users/00'), undefined);
  assert.throws(() => json.select('{"a":1,"b":[}', '/a'), code('ERR_JSON_SYNTAX'));
});

test('canonicalizeValue follows JSON.stringify where RFC 8785 allows', () => {
  const value = { z: new Number(1.5), y: new String('s'), x: [undefined, () => 0, Symbol('q')], w: undefined,
    v: { toJSON: (key) => `key:${key}` }, u: -0, t: 1e21, s: new Date(0) };
  assert.equal(json.canonicalizeValue(value),
    '{"s":"1970-01-01T00:00:00.000Z","t":1e+21,"u":0,"v":"key:v","x":[null,null,null],"y":"s","z":1.5}');
  assert.equal(json.canonicalizeValue(undefined), undefined);
  assert.throws(() => json.canonicalizeValue({ n: NaN }), code('ERR_JSON_NUMBER_RANGE'));
  assert.throws(() => json.canonicalizeValue(['\ud800']), code('ERR_JSON_LONE_SURROGATE'));
  assert.throws(() => json.canonicalizeValue({ ['\udc00']: 1 }), code('ERR_JSON_LONE_SURROGATE'));
  assert.throws(() => json.canonicalizeValue(1n), TypeError);
  const cycle = {};
  cycle.self = [cycle];
  assert.throws(() => json.canonicalizeValue(cycle), TypeError);
  const shared = { k: 1 };
  assert.equal(json.canonicalizeValue([shared, shared]), '[{"k":1},{"k":1}]');
});

test('deep and wide inputs', () => {
  const deep = '['.repeat(1024) + ']'.repeat(1024);
  assert.equal(json.minify(deep, { maxDepth: 1024 }), deep);
  assert.throws(() => json.minify('['.repeat(200000)), code('ERR_JSON_DEPTH'));
  const keys = Array.from({ length: 50000 }, (_, i) => `k${(i * 7919) % 50000}`);
  const wide = '{' + keys.map((k) => `"${k}":0`).join(',') + '}';
  assert.deepEqual(Object.keys(JSON.parse(json.sortKeys(wide))), keys.slice().sort());
});

test('review: option getters and later arguments cannot swap the shared input buffer', async () => {
  const a = '["' + 'A'.repeat(2000) + '"]', b = '["' + 'B'.repeat(2000) + '"]';
  const sneaky = { get strictNumbers() { json.validate(b); return false; }, get maxDepth() { json.minify(b); return 64; } };
  assert.equal(json.canonicalize(a, sneaky), a);
  assert.equal(json.select(a, '/0', sneaky), JSON.stringify('A'.repeat(2000)));
  assert.equal(json.equal(a, b, sneaky), false);
  assert.equal(await json.canonicalizeAsync(a, { get output() { json.validate(b); return 'string'; } }), a);
  class Tricky extends Uint8Array {
    get byteOffset() { json.validate(a.replace(/A/g, 'C')); return super.byteOffset; }
  }
  assert.equal(json.equal(a, new Tricky(Buffer.from(b))), false);
  assert.equal(json.equal(a, new Tricky(Buffer.from(a))), true);
});

test('review: strictNumbers rejects changed values, not inexact binary ones', () => {
  assert.throws(() => json.canonicalize('1152921504606846976', { strictNumbers: true }), (e) => e.code === 'ERR_JSON_PRECISION');
  assert.equal(json.canonicalize('1152921504606846976'), '1152921504606847000');
  assert.equal(json.canonicalize('1152921504606847000', { strictNumbers: true }), '1152921504606847000');
  assert.equal(json.canonicalize('0.1', { strictNumbers: true }), '0.1');
  assert.equal(json.canonicalize(String(2 ** -24), { strictNumbers: true }), String(2 ** -24));
});

test('review: deep unsorted nesting stays linear', () => {
  const value = '"' + 'x'.repeat(4 * 1024 * 1024) + '"';
  const nested = (d) => '{"b":'.repeat(d) + value + ',"a":0}'.repeat(d);
  const time = (d) => { const t = performance.now(); const out = json.sortKeys(nested(d), { maxDepth: 1024 }); return [performance.now() - t, out]; };
  time(1);
  const [shallow] = time(1);
  const [deep, out] = time(1000);
  assert.ok(out.startsWith('{"a":0,"b":{"a":0,"b":'), out.slice(0, 40));
  assert.equal(out.length, nested(1000).length);
  assert.ok(deep < shallow * 10 + 50, `depth 1000 took ${deep.toFixed(0)} ms vs ${shallow.toFixed(0)} ms`);
});
