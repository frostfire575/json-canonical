'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { fixtures, prepare, shuffled, median } = require('./run.cjs');
test('independent fixtures verify exact retained bytes and preserve source URLs', () => {
  const { sources, inputs } = fixtures();
  assert.equal(sources.length, 4);
  assert.equal(inputs['lock-normalized'].length, 93728);
  assert.ok(Buffer.byteLength(inputs['lock-source']) > Buffer.byteLength(inputs['lock-normalized']));
  for (const source of sources) assert.match(source.source, /^https:\/\/raw\.githubusercontent\.com\//);
  assert.equal(inputs['batch-api-records-32'].length, 32);
});
test('median and seeded shuffling are deterministic', () => {
  assert.equal(median([8, 2, 4, 1, 3]), 3);
  const values = [1, 2, 3, 4, 5, 6];
  assert.deepEqual(shuffled(values, 123), shuffled(values, 123));
  assert.deepEqual(values, [1, 2, 3, 4, 5, 6]);
  assert.notDeepEqual(shuffled(values, 123), shuffled(values, 124));
});
test('source and normalized text methods match exact upstream strings', () => {
  for (const dataset of ['lock-normalized', 'lock-source', 'api-normalized', 'api-source', 'unicode']) {
    for (const method of ['oracle', 'native', 'safe-stable', 'fast-stable']) {
      const candidate = prepare(dataset, method);
      assert.equal(candidate.fn(), candidate.expected, `${dataset}/${method}`);
      assert.equal(candidate.native.length, 1);
      assert.match(candidate.native[0].path, /\.node$/);
    }
  }
});
test('batch and explicit cache cases match exact upstream strings', () => {
  for (const dataset of ['batch-tiny-32', 'batch-api-records-32']) {
    for (const method of ['oracle-loop', 'native-loop', 'native-batch', 'public-loop', 'public-batch']) {
      const candidate = prepare(dataset, method);
      assert.equal(candidate.fn(), candidate.expected, `${dataset}/${method}`);
      assert.equal(candidate.units, 32);
    }
  }
  for (const method of ['oracle', 'public-stringify', 'cache-hit', 'cache-miss']) {
    const candidate = prepare('cache-api-document', method);
    assert.equal(candidate.fn(), candidate.expected);
  }
});
