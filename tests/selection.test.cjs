'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { selectJson } = require('../js/index.cjs');
test('selection pointer keys, Unicode, arrays, scalars, empty/root and missing', () => {
  const input = '{"a/b":{"~key":[10,{"বাংলা😀":"\\ud800"}]},"":null,"z": [3, 2]}';
  assert.equal(selectJson(input, '/a~1b/~0key/1/বাংলা😀'), '"\\ud800"');
  assert.equal(selectJson(input, '/'), 'null');
  assert.equal(selectJson(input, '/z'), '[3, 2]');
  assert.equal(selectJson(input, ''), input);
  for (const pointer of ['/missing', '/z/01', '/z/-', '/z/999999999999999999999999', '/z/0/no'])
    assert.equal(selectJson(input, pointer), undefined);
  assert.equal(selectJson('{"~1":2}', '/~01'), '2');
  assert.equal(selectJson('{"a":1,"a":2}', '/a'), '2');
  assert.equal(selectJson('{"\\u0061":1.00}', '/a'), '1.00');
});
test('selection validates whole document and limits even for missing/early path', () => {
  for (const input of ['{"a":1,"bad":[1,]}', '{} garbage', '["\\x00"]'])
    assert.throws(() => selectJson(input, '/a'));
  assert.throws(() => selectJson('{"a":1,"deep":[[[]]]}', '/a', { maxDepth: 2 }), /nesting/);
  assert.throws(() => selectJson('"😀"', '', { maxBytes: 5 }), /byte limit/);
  for (const pointer of ['foo', '#/a', '/bad~', '/bad~2', '/'.repeat(129)])
    assert.throws(() => selectJson('{}', pointer), RangeError);
  assert.throws(() => selectJson('"\ud800"', ''), TypeError);
  assert.throws(() => selectJson('{}', '/\ud800'), TypeError);
});
