'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const runner = require('./run.cjs');
const root = path.resolve(__dirname, '../..');
const candidate = process.env.NATIVE_TEXT_CANDIDATE;
test('five immutable real fixtures, licenses and nine explicit variants', () => {
  const all = runner.fixtures();
  assert.equal(all.sources.length, 5);
  assert.equal(Object.keys(all.cases).length, 9);
  for (const source of all.sources) {
    assert.match(source.source, /^https:\/\/raw\.githubusercontent\.com\//);
    assert.match(source.commit, /^[a-f0-9]{40}$/);
    assert.match(source.licenseSha256, /^[a-f0-9]{64}$/);
  }
  for (const id of ['lock', 'api', 'cldr']) {
    const original = all.cases[`${id}-original`].input;
    const normalized = all.cases[`${id}-normalized`].input;
    assert.notEqual(original, normalized);
    assert.deepEqual(JSON.parse(original), JSON.parse(normalized));
  }
  assert.ok(Buffer.byteLength(all.cases['api-user-small'].input) < 1000);
});
test('every actual installed operation has exact complete output and packed/native identity', () => {
  assert.ok(candidate, 'Provide verified installed candidate explicitly');
  for (const [id] of runner.definitions) for (const method of runner.methods) {
    const child = spawnSync(process.execPath, [path.join(__dirname, 'run.cjs'), '--worker', id, method], {
      cwd: root, encoding: 'utf8', env: { ...process.env, NATIVE_TEXT_CHECK_ONLY: '1' }, maxBuffer: 8 * 1024 * 1024,
    });
    assert.equal(child.status, 0, child.stderr);
    const report = JSON.parse(child.stdout);
    assert.equal(report.timed, false);
    assert.equal(report.beforeExact, true); assert.equal(report.afterExact, true);
    assert.equal(report.expectedSha256, report.beforeSha256); assert.equal(report.beforeSha256, report.afterSha256);
    assert.equal(report.native.length, method.endsWith('native') ? 1 : 0);
    assert.match(report.tarballSha256, /^[a-f0-9]{64}$/);
  }
});
test('lexical, duplicate and error hazards are explicitly excluded from equivalent timing', () => {
  const { api } = runner.packed(candidate);
  const controls = runner.lexicalControls(api);
  assert.equal(controls.length, 7);
  assert.ok(controls.every(control => control.timed === false));
  assert.equal(controls.filter(control => control.nativeRejected).length, 3);
  assert.equal(controls[0].native, '{"n":1.00,"s":"\\u0061","z":-0}');
  assert.equal(controls[1].native, '{"n":9007199254740993}');
  assert.equal(controls.at(-1).selection.scalar, '1.00');
});
test('provenance rejects altered installed bytes and altered tarball identity', () => {
  assert.ok(candidate);
  const source = path.resolve(root, candidate);
  const temporary = fs.mkdtempSync(path.join(__dirname, '.test-candidate-'));
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(source, 'candidate.json')));
    fs.copyFileSync(path.join(source, 'candidate.json'), path.join(temporary, 'candidate.json'));
    fs.copyFileSync(path.join(source, manifest.filename), path.join(temporary, manifest.filename));
    const destination = path.join(temporary, 'npm/node_modules/stable-json-rs');
    for (const filename of Object.keys(manifest.files)) {
      fs.mkdirSync(path.dirname(path.join(destination, filename)), { recursive: true });
      fs.copyFileSync(path.join(source, 'npm/node_modules/stable-json-rs', filename), path.join(destination, filename));
    }
    fs.writeFileSync(path.join(temporary, 'npm/package.json'), '{"private":true}');
    fs.appendFileSync(path.join(destination, 'js/dist/index.js'), '\n// tampered\n');
    assert.throws(() => runner.packed(temporary), /Installed js\/dist\/index.js/);
    fs.appendFileSync(path.join(temporary, manifest.filename), 'tampered');
    assert.throws(() => runner.packed(temporary), /Actual archive matches manifest/);
  } finally {
    const resolved = path.resolve(temporary);
    assert.ok(resolved.startsWith(path.resolve(__dirname) + path.sep));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
});
test('statistics, pointer decoding and reproducible randomized order', () => {
  assert.equal(runner.median([9, 1, 7, 5, 3]), 5);
  assert.equal(runner.median([4, 2]), 3);
  assert.deepEqual(runner.shuffle(runner.definitions, 9), runner.shuffle(runner.definitions, 9));
  assert.notDeepEqual(runner.shuffle(runner.definitions, 9), runner.shuffle(runner.definitions, 10));
  assert.equal(runner.lookup({ 'a/b': { '~': 'ok' } }, '/a~1b/~0'), 'ok');
});
test('candidate is mandatory and invalid timing configuration cannot produce results', () => {
  const env = { ...process.env }; delete env.NATIVE_TEXT_CANDIDATE;
  const missing = spawnSync(process.execPath, [path.join(__dirname, 'run.cjs')], { encoding: 'utf8', env });
  assert.notEqual(missing.status, 0); assert.match(missing.stderr, /Set NATIVE_TEXT_CANDIDATE explicitly/);
  const bad = spawnSync(process.execPath, [path.join(__dirname, 'run.cjs'), '--worker', 'config-original', 'sort-js'], {
    encoding: 'utf8', env: { ...process.env, NATIVE_TEXT_CANDIDATE: candidate, NATIVE_TEXT_CHECK_ONLY: '0', NATIVE_TEXT_WARMUP_MS: '1' },
  });
  assert.notEqual(bad.status, 0); assert.match(bad.stderr, /At least1s warmup/);
});
test('summary refuses incomplete or duplicate/relabelled evidence', () => {
  const { summarize } = require('./summarize.cjs');
  assert.throws(() => summarize({ results: [] }), /Only completed evidence/);
  const cell = { run: 1, id: 'fixture', method: 'sort-native', timed: true, beforeExact: true, afterExact: true, beforeSha256: 'a', expectedSha256: 'a', afterSha256: 'a', medianOpsPerSecond: 10, madPercent: 1, medianMicrosecondsPerOperation: 100000, inputMiBPerSecond: 1, outputMiBPerSecond: 1, resourceUsage: { maxRSS: 1024 }, cpuMicroseconds: { user: 10, system: 0 }, samples: [{ operations: 1 }] };
  const report = { finishedAt: 'test', configuration: { selected: ['fixture'], methods: ['sort-native'], repetitions: 2 }, results: [cell, { ...cell, run: 2 }] };
  assert.equal(summarize(report).groups[0].methods['sort-native'].medianOpsPerSecondAcrossRuns, 10);
  assert.throws(() => summarize({ ...report, results: [cell, { ...cell }] }), /No duplicate repetition/);
  assert.throws(() => summarize({ ...report, results: [cell, { ...cell, run: 2, afterSha256: 'wrong' }] }));
});
