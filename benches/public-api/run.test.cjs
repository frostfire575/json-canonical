'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { fixtures, datasets, methods, textMethods, selectionPaths, median, shuffled } = require('./run.cjs');
test('all real object fixtures preserve pinned data and license hashes', () => {
  const { sources, values } = fixtures();
  assert.equal(sources.length, 5);
  assert.deepEqual(Object.keys(values), datasets);
  for (const source of sources) {
    assert.match(source.source, /^https:\/\/raw\.githubusercontent\.com\//);
    assert.match(source.sha256, /^[a-f0-9]{64}$/);
    assert.match(source.licenseSha256, /^[a-f0-9]{64}$/);
  }
  assert.equal(values['api-comments-32'].length, 32);
});
test('each installed CJS/ESM alias and roundtrip exactly matches pinned upstream without timing', () => {
  for (const dataset of datasets) for (const method of methods) {
    const result = spawnSync(process.execPath, [path.join(__dirname, 'run.cjs'), '--worker', dataset, method], { encoding: 'utf8', env: { ...process.env, PUBLIC_API_CHECK_ONLY: '1' } });
    assert.equal(result.status, 0, result.stderr);
    const checked = JSON.parse(result.stdout);
    assert.equal(checked.exact, true);
    assert.equal(checked.timed, false);
    assert.equal(checked.native.length, method === 'native-roundtrip' ? 1 : 0);
    assert.match(checked.tarballSha256, /^[a-f0-9]{64}$/);
  }
});
test('original/current real batch and same-native loop preserve ordered exact strings', () => {
  for (const method of ['batch-current', 'batch-original', 'loop-current']) {
    const result = spawnSync(process.execPath, [path.join(__dirname, 'run.cjs'), '--worker', 'api-comments-batch32', method], { encoding: 'utf8', env: { ...process.env, PUBLIC_API_CHECK_ONLY: '1' } });
    assert.equal(result.status, 0, result.stderr);
    const checked = JSON.parse(result.stdout);
    assert.equal(checked.exact, true);
    assert.equal(checked.native.length, 1);
  }
});
test('statistics and shuffled cell order are deterministic', () => {
  assert.equal(median([9, 2, 4, 6, 1]), 4);
  assert.deepEqual(shuffled(methods, 1), shuffled(methods, 1));
  assert.notDeepEqual(shuffled(methods, 1), shuffled(methods, 2));
});
test('timing requires an explicit current installed candidate', () => {
  const env = { ...process.env };
  delete env.PUBLIC_API_CANDIDATE;
  delete env.PUBLIC_API_CHECK_ONLY;
  const result = spawnSync(process.execPath, [path.join(__dirname, 'run.cjs')], { encoding: 'utf8', env });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Set PUBLIC_API_CANDIDATE explicitly/);
});
test('normalized text and selected raw text match exact baseline strings', () => {
  for (const dataset of Object.keys(selectionPaths)) for (const method of textMethods) {
    const result = spawnSync(process.execPath, [path.join(__dirname, 'run.cjs'), '--worker', dataset, method], { encoding: 'utf8', env: { ...process.env, PUBLIC_API_CHECK_ONLY: '1' } });
    assert.equal(result.status, 0, result.stderr);
    const checked = JSON.parse(result.stdout);
    assert.equal(checked.exact, true);
    assert.equal(checked.native.length, method.startsWith('upstream') ? 0 : 1);
    if (method.includes('select')) assert.equal(checked.selectionPath, selectionPaths[dataset]);
  }
});
