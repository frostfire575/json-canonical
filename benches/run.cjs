'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync, execFileSync } = require('node:child_process');
const { performance } = require('node:perf_hooks');
const { datasets, describe } = require('./datasets.cjs');
const root = path.resolve(__dirname, '..');
const oracle = require('../upstream/fast-json-stable-stringify');
const sampleMs = Number(process.env.BENCH_SAMPLE_MS || 35);
const repetitions = Number(process.env.BENCH_REPS || 7);
if (!(sampleMs > 0) || !Number.isInteger(repetitions) || repetitions < 5) throw new Error('Use BENCH_SAMPLE_MS > 0 and integer BENCH_REPS >= 5');
let sink = 0;
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
function loadMethod(name, value) {
  if (name === 'JSON.stringify-context') return { fn: () => JSON.stringify(value), expected: JSON.stringify(value), comparable: false };
  if (name === 'upstream') return { fn: () => oracle(value), expected: oracle(value), comparable: true };
  if (name === 'upstream-from-text') {
    const input = JSON.stringify(value);
    return { fn: () => oracle(JSON.parse(input)), expected: oracle(value), comparable: true, input: 'pre-existing JSON text; parsing included' };
  }
  if (['safe-stable-stringify', 'fast-stable-stringify'].includes(name)) {
    const fn = require(name);
    return { fn: () => fn(value), expected: oracle(value), comparable: true };
  }
  if (name === 'batch-upstream-loop') return { fn: () => JSON.stringify(value.map((v) => oracle(v))), expected: JSON.stringify(value.map((v) => oracle(v))), comparable: true, units: value.length };
  if (name === 'batch-text-upstream-loop') {
    const inputs = value.map((v) => JSON.stringify(v));
    return { fn: () => JSON.stringify(inputs.map((text) => oracle(JSON.parse(text)))), expected: JSON.stringify(value.map((v) => oracle(v))), comparable: true, units: value.length, input: 'batch of pre-existing JSON texts' };
  }
  const api = require('../js/index.cjs');
  const expected = oracle(value);
  if (name === 'public-stringify') return { fn: () => api.stringify(value), expected, comparable: true };
  if (name === 'native-text') {
    const input = JSON.stringify(value);
    return { fn: () => api.stringifyJson(input), expected, comparable: true, input: 'pre-existing JSON text; object conversion excluded' };
  }
  if (name === 'native-roundtrip') return { fn: () => api.stringifyJson(JSON.stringify(value)), expected, comparable: true, input: 'JS object; JSON.stringify conversion included' };
  if (name === 'batch-public') return { fn: () => JSON.stringify(api.stringifyBatch(value)), expected: JSON.stringify(value.map((v) => oracle(v))), comparable: true, units: value.length };
  if (name === 'batch-text-native' || name === 'batch-text-native-loop') {
    const inputs = value.map((v) => JSON.stringify(v));
    const fn = name === 'batch-text-native'
      ? () => JSON.stringify(api.stringifyJsonBatch(inputs))
      : () => JSON.stringify(inputs.map((input) => api.stringifyJson(input)));
    return { fn, expected: JSON.stringify(value.map((v) => oracle(v))), comparable: true, units: value.length, input: 'batch of pre-existing JSON texts' };
  }
  if (name === 'cache-hit' || name === 'cache-miss') {
    const cache = api.createSerializerCache();
    // Explicit version is part of the caller contract; hit input is unchanged.
    let version = 0;
    const fn = name === 'cache-hit' ? () => cache.stringify(value, 1) : () => cache.stringify(value, ++version);
    return { fn, expected, comparable: true, cache: name === 'cache-hit' ? 'same identity/version' : 'same identity/new version every call' };
  }
  throw new Error(`Unknown method ${name}`);
}
function consume(value) {
  sink = (sink + value.length + value.charCodeAt(value.length >>> 1)) >>> 0;
}
function runFor(fn, milliseconds) {
  let count = 0;
  const start = performance.now();
  // Check the clock every 16 calls to amortize timer overhead. Large operations
  // can overshoot the target; elapsed time, rather than target, is recorded.
  do {
    for (let j = 0; j < 16; j++) { consume(fn()); count++; }
  } while (performance.now() - start < milliseconds);
  return { iterations: count, elapsedMs: performance.now() - start };
}
async function worker(dataset, method) {
  const value = datasets()[dataset];
  let prepared;
  try { prepared = loadMethod(method, value); }
  catch (error) {
    if (error.code === 'MODULE_NOT_FOUND' || /is not a function/.test(error.message)) return { dataset, method, status: 'UNAVAILABLE', reason: error.message };
    throw error;
  }
  const { fn, expected } = prepared;
  try { assert.equal(fn(), expected); }
  catch (error) {
    return { dataset, method,
      status: error.code === 'MODULE_NOT_FOUND' || /is not a function/.test(error.message) ? 'UNAVAILABLE' : 'INCOMPATIBLE', reason: error.message };
  }
  runFor(fn, sampleMs * 2);
  const cpuStart = process.cpuUsage();
  const memoryBefore = process.memoryUsage();
  const samples = [];
  // Yield between repetitions so the probe describes one sample's blocking
  // impact, and permits timer work rather than measuring a whole-run stall.
  const timerDelaysMs = [];
  for (let rep = 0; rep < repetitions; rep++) {
    await new Promise((resolve) => setImmediate(resolve));
    const scheduled = performance.now();
    const probe = new Promise((resolve) => setTimeout(() => resolve(performance.now() - scheduled), 0));
    const sample = runFor(fn, sampleMs);
    samples.push({ ...sample, opsPerSecond: sample.iterations / sample.elapsedMs * 1000 });
    timerDelaysMs.push(await probe);
  }
  const cpu = process.cpuUsage(cpuStart);
  const memoryAfter = process.memoryUsage();
  const rates = samples.map((s) => s.opsPerSecond);
  const rate = median(rates);
  const mad = median(rates.map((n) => Math.abs(n - rate)));
  return { dataset, method, status: 'OK', comparableStableOperation: prepared.comparable,
    inputContract: prepared.input, cacheContract: prepared.cache, unitsPerOperation: prepared.units || 1,
    ...describe(value), outputBytes: Buffer.byteLength(expected), repetitions, sampleMs,
    medianOpsPerSecond: rate, medianItemsPerSecond: rate * (prepared.units || 1), medianLatencyUs: 1e6 / rate, madPercent: mad / rate * 100,
    minOpsPerSecond: Math.min(...rates), maxOpsPerSecond: Math.max(...rates),
    outputMiBPerSecond: rate * Buffer.byteLength(expected) / 1048576,
    cpuMicroseconds: cpu, rssBeforeBytes: memoryBefore.rss, rssAfterBytes: memoryAfter.rss,
    processMaxRssBytes: process.resourceUsage().maxRSS * 1024,
    heapUsedBeforeBytes: memoryBefore.heapUsed, heapUsedAfterBytes: memoryAfter.heapUsed,
    timerDelayMs: { median: median(timerDelaysMs), max: Math.max(...timerDelaysMs), samples: timerDelaysMs }, samples, sink };
}
function command(file, args) {
  try { return execFileSync(file, args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return 'UNAVAILABLE'; }
}
function coldStart(modulePath) {
  const samples = [];
  for (let i = 0; i < 5; i++) {
    const result = spawnSync(process.execPath, ['-e', `const {performance}=require('node:perf_hooks'); const t=performance.now(); require(${JSON.stringify(modulePath)}); process.stdout.write(String(performance.now()-t));`], { cwd: root, encoding: 'utf8' });
    if (result.status !== 0) return { module: modulePath, status: 'UNAVAILABLE', reason: result.stderr.trim() };
    samples.push(Number(result.stdout));
  }
  return { module: modulePath, status: 'OK', medianRequireMs: median(samples), samples, contract: 'fresh process require duration; OS disk cache may be warm; process startup excluded' };
}
function fileHash(filename) {
  try { return crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex'); }
  catch { return 'UNAVAILABLE'; }
}
function packageVersion(name) {
  try {
    let directory = path.dirname(require.resolve(name));
    while (directory !== path.dirname(directory)) {
      const filename = path.join(directory, 'package.json');
      if (fs.existsSync(filename)) {
        const pkg = JSON.parse(fs.readFileSync(filename, 'utf8'));
        if (pkg.name === name) return pkg.version;
      }
      directory = path.dirname(directory);
    }
  } catch { /* Missing optional competitor. */ }
  return 'UNAVAILABLE';
}
async function main() {
  const selected = process.env.BENCH_DATASETS?.split(',') || Object.keys(datasets());
  for (const name of selected) if (!(name in datasets())) throw new Error(`Unknown dataset ${name}`);
  const methods = process.env.BENCH_METHODS?.split(',') || ['JSON.stringify-context', 'upstream', 'safe-stable-stringify', 'fast-stable-stringify', 'public-stringify', 'upstream-from-text', 'native-text', 'native-roundtrip'];
  const timestamp = new Date().toISOString();
  const report = {
    timestamp, command: 'node benches/run.cjs', workingDirectory: root,
    configuration: { BENCH_REPS: String(repetitions), BENCH_SAMPLE_MS: String(sampleMs),
      BENCH_DATASETS: process.env.BENCH_DATASETS || null, BENCH_METHODS: process.env.BENCH_METHODS || null,
      note: 'null means variable unset; when BENCH_METHODS is unset, batch/cache extras are automatically included for batch-32' },
    environment: { platform: process.platform, arch: process.arch, osRelease: os.release(), node: process.version, v8: process.versions.v8,
      cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length, totalMemoryBytes: os.totalmem(), rust: command('rustc', ['--version']),
      commit: command('git', ['rev-parse', 'HEAD']), dirty: command('git', ['status', '--short']), upstreamCommit: command('git', ['-C', 'upstream/fast-json-stable-stringify', 'rev-parse', 'HEAD']),
      dependencies: Object.fromEntries(['safe-stable-stringify', 'fast-stable-stringify', '@napi-rs/cli'].map((name) => [name, packageVersion(name)])),
      sourceHashes: Object.fromEntries(['benches/run.cjs', 'benches/datasets.cjs', 'js/dist/index.js', 'src/lib.rs', 'src/engine.rs', 'pnpm-lock.yaml'].map((file) => [file, fileHash(path.join(root, file))])),
      nativeArtifacts: fs.existsSync(path.join(root, 'native')) ? fs.readdirSync(path.join(root, 'native')).filter((name) => name.endsWith('.node')).map((name) => ({ file: name, sha256: fileHash(path.join(root, 'native', name)) })) : [] },
    coldStart: ['./upstream/fast-json-stable-stringify', './js/index.cjs', './native/binding.js'].map(coldStart), results: [],
    limitations: ['Sampled RSS and process maximum RSS include runtime, fixture preparation, require and warmup; they are not allocation counts or serializer-only peaks.',
      'Timer probes measure synchronous sample-burst blocking plus timer scheduling, not per-request event-loop delay or asynchronous responsiveness.',
      'Native text accepts pre-existing JSON; compare separately with parse-and-sort JS and use native-roundtrip for JS object conversion cost.',
      'JSON.stringify-context is not stable serialization; all stable-compatible candidates must match the oracle exact string before timing.',
      'Each cell uses a fresh process. Runs are serial and fixed-order; OS scheduling, thermal state and GC influence results. These are local exploratory measurements, not cross-platform claims.']
  };
  for (const dataset of selected) {
    const allMethods = [...methods, ...(dataset === 'batch-32' && !process.env.BENCH_METHODS ? ['batch-public', 'batch-upstream-loop', 'batch-text-native', 'batch-text-native-loop', 'batch-text-upstream-loop', 'cache-hit', 'cache-miss'] : [])];
    for (const method of allMethods) {
      const result = spawnSync(process.execPath, [__filename, '--worker', dataset, method], { cwd: root, encoding: 'utf8', timeout: 120000 });
      const item = result.status === 0 ? JSON.parse(result.stdout) : { dataset, method, status: 'ERROR', reason: result.stderr || result.error?.message };
      report.results.push(item);
      console.log(`${dataset.padEnd(23)} ${method.padEnd(23)} ${item.status === 'OK' ? `${item.medianOpsPerSecond.toFixed(1)} ops/s MAD ${item.madPercent.toFixed(1)}%` : item.status}`);
    }
  }
  fs.mkdirSync(path.join(__dirname, 'results'), { recursive: true });
  const filename = path.join(__dirname, 'results', `${timestamp.replace(/[:.]/g, '-')}-${process.pid}.json`);
  fs.writeFileSync(filename, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(`Raw results: ${path.relative(root, filename)}`);
  if (report.results.some((r) => r.status === 'ERROR')) process.exitCode = 1;
}
if (process.argv[2] === '--worker') worker(process.argv[3], process.argv[4]).then((result) => process.stdout.write(JSON.stringify(result))).catch((error) => { console.error(error); process.exitCode = 1; });
else main().catch((error) => { console.error(error); process.exitCode = 1; });
