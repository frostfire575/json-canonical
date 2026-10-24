'use strict';
// Seeded differential tests. The oracles are V8 itself: JSON.parse for meaning,
// String(Number) for RFC 8785 numbers and Array.prototype.sort for UTF-16 key order.
const test = require('node:test');
const assert = require('node:assert/strict');
const json = require('..');

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CHARS = ['a', 'b', 'Z', '0', '9', ' ', '"', '\\', '/', '\n', '\t', '\u0000', '\u001f', '\u007f', 'é', '€',
  ' ', '퟿', '', '￿', '😀', '\u{10ffff}', '~', 'דּ'];

function randomDouble(next) {
  const view = new DataView(new ArrayBuffer(8));
  view.setUint32(0, (next() * 2 ** 32) >>> 0);
  view.setUint32(4, (next() * 2 ** 32) >>> 0);
  const value = view.getFloat64(0);
  return Number.isFinite(value) ? value : 0;
}

function randomNumber(next) {
  switch (Math.floor(next() * 6)) {
    case 0: return Math.floor(next() * 2000) - 1000;
    case 1: return (next() - 0.5) * 10 ** Math.floor(next() * 40 - 20);
    case 2: return randomDouble(next);
    case 3: return [0, -0, 1e21, 1e-7, 5e-324, 2 ** 53, 0.1, 1.7976931348623157e308][Math.floor(next() * 8)];
    default: return Math.round(next() * 1e6) / 100;
  }
}

function randomString(next) {
  let s = '';
  for (let i = Math.floor(next() * 5); i > 0; i--) s += CHARS[Math.floor(next() * CHARS.length)];
  return s;
}

function randomValue(next, depth = 0) {
  const pick = Math.floor(next() * (depth > 4 ? 4 : 7));
  if (pick === 0) return [null, true, false][Math.floor(next() * 3)];
  if (pick === 1) return randomNumber(next);
  if (pick === 2 || pick === 3) return randomString(next);
  if (pick === 4) return Array.from({ length: Math.floor(next() * 5) }, () => randomValue(next, depth + 1));
  const object = {};
  for (let i = Math.floor(next() * 6); i > 0; i--) object[randomString(next)] = randomValue(next, depth + 1);
  return object;
}

/** Many spellings of the same number; every one parses to exactly `n`. */
function spellNumber(n, next) {
  const options = [String(n), n.toExponential(), n.toPrecision(17), n.toExponential(20)];
  if (Number.isInteger(n) && Math.abs(n) < 1e15) options.push(n.toFixed(2), `${n}e0`, n === 0 ? "0.0" : `${n}0e-1`);
  return options[Math.floor(next() * options.length)].replace('e+', next() < 0.5 ? 'E+' : 'e');
}

function spellString(s, next) {
  let out = '"';
  for (const c of s) {
    if (next() < 0.3) {
      for (const unit of c.split('')) out += '\\u' + unit.charCodeAt(0).toString(16).padStart(4, '0')[next() < 0.5 ? 'toUpperCase' : 'toLowerCase']();
    } else if (c === '/' && next() < 0.5) {
      out += '\\/';
    } else {
      out += JSON.stringify(c).slice(1, -1);
    }
  }
  return out + '"';
}

/** Valid JSON text for `value` with random whitespace, key order and token spelling. */
function spell(value, next) {
  const ws = () => ['', ' ', '\n', '\t', '\r\n  '][Math.floor(next() * 5)];
  if (value === null || typeof value === 'boolean') return String(value);
  if (typeof value === 'number') return spellNumber(value, next);
  if (typeof value === 'string') return spellString(value, next);
  if (Array.isArray(value)) return '[' + value.map(v => ws() + spell(v, next) + ws()).join(',') + ']';
  const keys = Object.keys(value).sort(() => next() - 0.5);
  return '{' + keys.map(k => ws() + spellString(k, next) + ws() + ':' + ws() + spell(value[k], next)).join(',') + ws() + '}';
}

test('canonicalize matches the V8-based oracle across 20,000 seeded documents', () => {
  const next = rng(20261024);
  for (let i = 0; i < 20000; i++) {
    const text = spell(randomValue(next), next);
    const expected = json.canonicalizeValue(JSON.parse(text));
    assert.equal(json.canonicalize(text), expected, text);
    assert.equal(json.canonicalize(Buffer.from(text)), expected);
    assert.equal(json.canonicalize(expected), expected, 'canonical form is a fixed point');
  }
});

test('large documents take the encodeInto path and still match the oracle', () => {
  const next = rng(1024);
  for (let i = 0; i < 1000; i++) {
    const value = Array.from({ length: 60 }, () => randomValue(next));
    const text = spell(value, next);
    assert.ok(text.length >= 1024);
    assert.equal(json.canonicalize(text), json.canonicalizeValue(value));
    assert.equal(json.sortKeys(json.minify(text)), json.sortKeys(text));
    assert.equal(json.equal(text, json.canonicalize(text)), true);
  }
});

test('canonical numbers equal String(Number) for 1,000,000 seeded doubles and spellings', () => {
  const next = rng(7);
  for (let i = 0; i < 1000000; i++) {
    const n = i % 2 ? randomDouble(next) : randomNumber(next);
    const text = spellNumber(n, next);
    assert.equal(json.canonicalize(text), String(n), text);
  }
});

test('canonical numbers equal String(Number) for every power of two and its neighbours', () => {
  const view = new DataView(new ArrayBuffer(8));
  for (let exponent = 0; exponent < 2047; exponent++) {
    for (const delta of [-1n, 0n, 1n]) {
      const bits = (BigInt(exponent) << 52n) + delta;
      if (bits < 1n) continue;
      view.setBigUint64(0, bits);
      const n = view.getFloat64(0);
      if (!Number.isFinite(n)) continue;
      for (const text of [n.toPrecision(17), n.toExponential(20), String(n)]) {
        assert.equal(json.canonicalize(text), String(n), text);
      }
      assert.equal(json.canonicalize(String(n), { strictNumbers: true }), String(n));
    }
  }
});

test('sortKeys keeps token spelling and matches the oracle on canonical spellings', () => {
  const next = rng(99);
  for (let i = 0; i < 10000; i++) {
    const value = randomValue(next);
    const plain = JSON.stringify(value);
    assert.equal(json.sortKeys(plain), json.canonicalizeValue(value));
    const text = spell(value, next);
    const sorted = json.sortKeys(text);
    assert.deepEqual(JSON.parse(sorted), JSON.parse(text));
    assert.equal(json.sortKeys(sorted), sorted);
    assert.equal(json.canonicalize(sorted), json.canonicalize(text));
    const minified = json.minify(text);
    assert.deepEqual(JSON.parse(minified), JSON.parse(text));
    assert.equal(minified, json.minify(minified));
  }
});

function walk(value, path) {
  for (const segment of path) {
    if (Array.isArray(value)) {
      if (!/^(0|[1-9]\d*)$/.test(segment) || Number(segment) >= value.length) return undefined;
      value = value[Number(segment)];
    } else if (value !== null && typeof value === 'object' && Object.hasOwn(value, segment)) {
      value = value[segment];
    } else {
      return undefined;
    }
  }
  return value;
}

test('select agrees with JSON.parse navigation, including duplicates and pointer escapes', () => {
  const next = rng(4242);
  let found = 0;
  for (let i = 0; i < 10000; i++) {
    const value = randomValue(next);
    const text = spell(value, next);
    const path = [];
    let cursor = value;
    while (cursor !== null && typeof cursor === 'object' && next() < 0.8) {
      const keys = Object.keys(cursor);
      if (keys.length === 0 || next() < 0.1) { path.push(next() < 0.5 ? 'missing' : '7'); break; }
      const key = keys[Math.floor(next() * keys.length)];
      path.push(key);
      cursor = cursor[key];
    }
    const pointer = path.map(p => '/' + p.replaceAll('~', '~0').replaceAll('/', '~1')).join('');
    const expected = walk(JSON.parse(text), path);
    const raw = json.select(text, pointer);
    if (expected === undefined) assert.equal(raw, undefined, `${pointer} in ${text}`);
    else { found++; assert.deepEqual(JSON.parse(raw), expected, `${pointer} in ${text}`); }
  }
  assert.ok(found > 5000, String(found));
  const dup = '{"a":{"x":1},"a":{"y":2}}';
  assert.equal(json.select(dup, '/a/x'), JSON.parse(dup).a.x);
  assert.equal(json.select(dup, '/a/y'), '2');
});

test('validity agrees with JSON.parse on 30,000 seeded mutations', () => {
  const next = rng(31337);
  const noise = '{}[],:"\\01e.-tnx \u0001';
  let rejected = 0;
  for (let i = 0; i < 30000; i++) {
    let text = spell(randomValue(next), next);
    for (let m = Math.floor(next() * 3); m >= 0; m--) {
      const at = Math.floor(next() * (text.length + 1));
      const op = Math.floor(next() * 3);
      const c = noise[Math.floor(next() * noise.length)];
      text = op === 0 ? text.slice(0, at) + text.slice(at + 1) : op === 1 ? text.slice(0, at) + c + text.slice(at) : text.slice(0, at) + c + text.slice(at + 1);
    }
    if (!text.isWellFormed()) continue;
    let expected = true;
    try { JSON.parse(text); } catch { expected = false; }
    assert.equal(json.isValid(text), expected, JSON.stringify(text));
    if (!expected) {
      rejected++;
      assert.throws(() => json.canonicalize(text), json.JsonError);
    }
  }
  assert.ok(rejected > 10000, String(rejected));
});
