'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { fixtures, prepare, shuffled, median } = require('./run.cjs');
test('independent fixtures verify exact retained bytes and preserve source URLs', () => {
  const { sources, inputs } = fixtures();
  assert.ok(sources.length >= 4);
  assert.equal(inputs['lock-normalized'].length, 93728);
  assert.ok(Buffer.byteLength(inputs['lock-source']) > Buffer.byteLength(inputs['lock-normalized']));
  for (const source of sources) assert.match(source.source, /^https:\/\/raw\.githubusercontent\.com\//);
  assert.equal(inputs['batch-api-records-32'].length, 32);
});
test('encoding density controls and retained CLDR fixture match exact stable strings', () => {
  for (const dataset of ['latin1-large', 'sparse-unicode', 'ascii-string-50k', 'short-unicode', 'real-cldr-bn', 'unicode-prefix-ascii-tail', 'ascii-prefix-unicode-tail', 'ascii-prefix-dense-unicode']) {
    for (const method of ['native', 'oracle']) {
      const candidate = prepare(dataset, method);
      assert.equal(candidate.fn(), candidate.expected, `${dataset}/${method}`);
    }
  }
  const source = fixtures().sources.find(source => source.file === 'cldr-bn-languages.json');
  assert.equal(source.license, 'Unicode-3.0');
  assert.equal(source.commit, '91c267402229a59e3ef2774544f001bf959e8809');
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
test('expanded text, object and selection cases match exact oracle operations', () => {
  for (const dataset of ['tiny', 'deep', 'wide', 'application-config', 'upstream-api-fixture', 'large-string', 'record-array', 'backend-payload', 'array-of-32']) {
    for (const method of ['oracle', 'native', 'object-oracle', 'object-public', 'object-native-roundtrip', 'object-safe-stable', 'object-fast-stable', 'JSON-context']) {
      const candidate = prepare(dataset, method);
      assert.deepEqual(candidate.fn(), candidate.expected, `${dataset}/${method}`);
      assert.equal(candidate.comparableStableOperation, method !== 'JSON-context');
    }
  }
  for (const dataset of ['tiny', 'deep', 'wide', 'lock-normalized', 'api-normalized', 'unicode']) {
    for (const method of ['select-native-text', 'select-oracle-text', 'select-native-scalar', 'select-oracle-scalar']) {
      const candidate = prepare(dataset, method);
      assert.equal(candidate.fn(), candidate.expected, `${dataset}/${method}`);
      assert.equal(candidate.scalarOutput, method.endsWith('-scalar'));
    }
  }
});
test('element-consumed real batches and versioned mutation pools have independent oracles', () => {
  for (const count of [1, 8, 32, 128]) {
    for (const method of ['native-batch-elements', 'native-loop-elements', 'oracle-loop-elements']) {
      const candidate = prepare(`batch-api-elements-${count}`, method);
      assert.deepEqual(candidate.fn(), candidate.expected);
      assert.equal(candidate.units, count);
      assert.equal(candidate.arrayOutput, true);
    }
  }
  for (const size of [32, 128]) {
    for (const ratio of [0, 50, 90, 99]) {
      const candidates = ['cache-pool', 'public-pool', 'oracle-pool'].map(method => prepare(`cache-pool-${size}-hit${ratio}`, method));
      for (let i = 0; i < 400; i++) {
        const outputs = candidates.map(candidate => candidate.fn());
        assert.equal(outputs[0], outputs[2]);
        assert.equal(outputs[1], outputs[2]);
      }
      assert.equal(candidates[0].cachePool.plannedHitPercent, ratio);
      assert.equal(candidates[0].cachePool.size, size);
    }
  }
});
