'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { datasets, describe } = require('./datasets.cjs');

test('retained real fixture hashes, byte sizes and license files match manifest', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/manifest.json')));
  assert.ok(manifest.length >= 3);
  for (const item of manifest) {
    const raw = fs.readFileSync(path.join(__dirname, 'data', item.file));
    assert.equal(raw.length, item.bytes);
    assert.equal(crypto.createHash('sha256').update(raw).digest('hex'), item.sha256);
    assert.match(item.commit, /^[a-f0-9]{40}$/);
    assert.ok(fs.statSync(path.join(__dirname, 'data', item.licenseFile)).size > 100);
    assert.doesNotThrow(() => JSON.parse(raw));
  }
});

test('generated datasets are deterministic and cover diverse workloads', () => {
  const first = datasets();
  const second = datasets();
  assert.deepEqual(Object.keys(first), Object.keys(second));
  for (const key of Object.keys(first)) assert.deepEqual(describe(first[key]), describe(second[key]));
  assert.ok(describe(first['dependency-lock']).jsonBytes > 70000);
  assert.ok(describe(first['large-string']).jsonBytes > 150000);
  assert.equal(first['batch-32'].length, 32);
  assert.ok(JSON.stringify(first.unicode).includes('বাংলা'));
});

test('worker emits validated, observable measurements with at least five samples', () => {
  const result = spawnSync(process.execPath, [path.join(__dirname, 'run.cjs'), '--worker', 'tiny', 'upstream'], {
    encoding: 'utf8', env: { ...process.env, BENCH_REPS: '5', BENCH_SAMPLE_MS: '1' },
  });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, 'OK');
  assert.equal(report.samples.length, 5);
  assert.equal(report.comparableStableOperation, true);
  assert.ok(report.medianOpsPerSecond > 0);
  assert.ok(report.medianLatencyUs > 0);
  assert.ok(report.outputBytes > 0);
  assert.ok(report.sink > 0);
  assert.ok(report.processMaxRssBytes >= report.rssBeforeBytes);
  assert.equal(report.timerDelayMs.samples.length, 5);
});

test('fewer than five repetitions are rejected', () => {
  const result = spawnSync(process.execPath, [path.join(__dirname, 'run.cjs'), '--worker', 'tiny', 'upstream'], {
    encoding: 'utf8', env: { ...process.env, BENCH_REPS: '4', BENCH_SAMPLE_MS: '1' },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /BENCH_REPS >= 5/);
});
