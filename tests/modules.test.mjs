import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as esm from 'stable-json-rs';

const cjs = createRequire(import.meta.url)('stable-json-rs');

test('ESM and CommonJS expose the same functions', () => {
  const names = ['JsonError', 'canonicalize', 'canonicalizeAsync', 'sortKeys', 'sortKeysAsync', 'minify', 'minifyAsync',
    'validate', 'isValid', 'select', 'equal', 'canonicalHash', 'canonicalizeValue'];
  for (const name of names) {
    assert.equal(typeof esm[name], 'function', name);
    assert.equal(esm[name], cjs[name], name);
  }
  assert.deepEqual(Object.keys(esm).filter((k) => k !== 'default').sort(), names.slice().sort());
  assert.equal(esm.canonicalize('{"b":1,"a":2}'), '{"a":2,"b":1}');
});
