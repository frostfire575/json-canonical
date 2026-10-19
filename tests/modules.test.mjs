import test from 'node:test';
import assert from 'node:assert/strict';
import stringify, { stableStringify, stringifyJson } from 'stable-json-rs';
import { createRequire } from 'node:module';
test('package export ESM and CJS load and execute native and compatibility APIs', () => {
  assert.equal(stringify, stableStringify);
  assert.equal(stringify({ b: 2, a: 1 }), '{"a":1,"b":2}');
  assert.equal(stringifyJson('{"b":2,"a":1}'), '{"a":1,"b":2}');
  const cjs = createRequire(import.meta.url)('stable-json-rs');
  assert.equal(cjs.stringify, stringify);
});
