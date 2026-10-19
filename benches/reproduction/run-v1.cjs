'use strict';
// Independent reproduction: does not import benches/run.cjs or datasets.cjs.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const { spawnSync, execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const median = values => [...values].sort((a, b) => a - b)[values.length >> 1];
function read(relative) { return fs.readFileSync(path.join(root, relative)); }
function command(program, args) {
  try { return execFileSync(program, args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return 'UNAVAILABLE'; }
}
function packageVersion(name) {
  let directory = path.dirname(require.resolve(name));
  while (directory !== path.dirname(directory)) {
    const candidate = path.join(directory, 'package.json');
    if (fs.existsSync(candidate)) {
      const manifest = JSON.parse(fs.readFileSync(candidate));
      if (manifest.name === name) return manifest.version;
    }
    directory = path.dirname(directory);
  }
  throw new Error(`Package metadata not found: ${name}`);
}
function fixtures() {
  const manifest = JSON.parse(read('benches/data/manifest.json'));
  const sources = manifest.map(item => {
    const bytes = read(`benches/data/${item.file}`);
    assert.equal(bytes.length, item.bytes, item.file);
    assert.equal(sha(bytes), item.sha256, item.file);
    assert.ok(read(`benches/data/${item.licenseFile}`).length > 100);
    const source = bytes.toString('utf8');
    const value = JSON.parse(source);
    const normalized = JSON.stringify(value);
    return { ...item, value, source, normalized, normalizedBytes: Buffer.byteLength(normalized), normalizedSha256: sha(normalized) };
  });
  const fixture = name => sources.find(item => item.file === name);
  const unicode = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`বাংলা😀${i}`, '日本語\nالعربية\\বাংলা😀'.repeat(8)]));
  const tinyBatch = Array.from({ length: 32 }, (_, i) => ({ z: i, a: { state: true, message: `row ${i}` } }));
  const api = fixture('jsonplaceholder-data.json');
  return { sources, inputs: {
    'lock-normalized': fixture('typescript-package-lock.json').normalized,
    'lock-source': fixture('typescript-package-lock.json').source,
    'api-normalized': api.normalized,
    'api-source': api.source,
    'unicode': JSON.stringify(unicode),
    'batch-tiny-32': tinyBatch.map(value => JSON.stringify(value)),
    'batch-api-records-32': api.value.comments.slice(0, 32).map(value => JSON.stringify(value)),
    'cache-api-document': api.value,
  } };
}
function prepare(dataset, method) {
  const { inputs } = fixtures();
  const input = inputs[dataset];
  assert.notEqual(input, undefined, dataset);
  const oracle = require(path.join(root, 'upstream/fast-json-stable-stringify'));
  const api = require(path.join(root, 'js/index.cjs'));
  const isBatch = Array.isArray(input);
  const isCache = dataset.startsWith('cache-');
  const expected = isCache ? oracle(input) : isBatch ? JSON.stringify(input.map(text => oracle(JSON.parse(text)))) : oracle(JSON.parse(input));
  let fn;
  if (isCache) {
    const cache = api.createSerializerCache();
    let version = 0;
    if (method === 'cache-hit') { cache.stringify(input, 1); fn = () => cache.stringify(input, 1); }
    else if (method === 'cache-miss') fn = () => cache.stringify(input, ++version);
    else if (method === 'public-stringify') fn = () => api.stringify(input);
    else if (method === 'oracle') fn = () => oracle(input);
  } else if (isBatch) {
    if (method === 'native-batch') fn = () => JSON.stringify(api.stringifyJsonBatch(input));
    else if (method === 'native-loop') fn = () => JSON.stringify(input.map(text => api.stringifyJson(text)));
    else if (method === 'oracle-loop') fn = () => JSON.stringify(input.map(text => oracle(JSON.parse(text))));
    else if (method === 'public-batch' || method === 'public-loop') {
      const objects = input.map(text => JSON.parse(text));
      fn = method === 'public-batch' ? () => JSON.stringify(api.stringifyBatch(objects)) : () => JSON.stringify(objects.map(value => api.stringify(value)));
    }
  } else {
    if (method === 'native') fn = () => api.stringifyJson(input);
    else if (method === 'oracle') fn = () => oracle(JSON.parse(input));
    else if (method === 'safe-stable' || method === 'fast-stable') {
      const stringify = require(method === 'safe-stable' ? 'safe-stable-stringify' : 'fast-stable-stringify');
      fn = () => stringify(JSON.parse(input));
    }
  }
  assert.equal(typeof fn, 'function', `${dataset}/${method}`);
  // Load the real native addon and establish its identity, even for JS candidates.
  api.stringifyJson('{}');
  const native = Object.keys(require.cache).filter(file => file.endsWith('.node')).map(file => ({ path: path.relative(root, file), sha256: sha(fs.readFileSync(file)) }));
  assert.equal(native.length, 1, 'Exactly one actual native addon must be loaded');
  const actual = fn();
  assert.equal(actual, expected, `${dataset}/${method}: exact output`);
  return { fn, expected, native, inputBytes: isCache ? Buffer.byteLength(JSON.stringify(input)) : isBatch ? input.reduce((sum, text) => sum + Buffer.byteLength(text), 0) : Buffer.byteLength(input), inputSha256: sha(JSON.stringify(input)), units: isBatch ? input.length : 1 };
}
function runFor(fn, milliseconds, checksumState) {
  let iterations = 0;
  const started = performance.now();
  do {
    for (let i = 0; i < 16; i++) {
      const result = fn();
      // Same observable consumption as historical runner: includes rope flattening.
      checksumState.value = (checksumState.value + result.length + result.charCodeAt(result.length >>> 1)) >>> 0;
      iterations++;
    }
  } while (performance.now() - started < milliseconds);
  const elapsedMs = performance.now() - started;
  return { iterations, elapsedMs, opsPerSecond: iterations * 1000 / elapsedMs };
}
async function cell(dataset, method, config, checkOnly = false) {
  const prepared = prepare(dataset, method);
  const base = { dataset, method, exactOutputVerified: true, outputSha256: sha(prepared.expected), outputBytes: Buffer.byteLength(prepared.expected), inputBytes: prepared.inputBytes, inputSha256: prepared.inputSha256, unitsPerOperation: prepared.units, nativeArtifacts: prepared.native };
  if (checkOnly) return base;
  const checksum = { value: 0 };
  const warmup = runFor(prepared.fn, config.warmupMs, checksum);
  const memoryBefore = process.memoryUsage();
  const cpuStart = process.cpuUsage();
  const samples = [];
  for (let i = 0; i < config.samples; i++) {
    await new Promise(resolve => setImmediate(resolve));
    samples.push(runFor(prepared.fn, config.sampleMs, checksum));
  }
  const cpuMicroseconds = process.cpuUsage(cpuStart);
  const rates = samples.map(sample => sample.opsPerSecond);
  const middle = median(rates);
  return { ...base, warmup, samples, medianOpsPerSecond: middle, medianItemsPerSecond: middle * prepared.units,
    madPercent: median(rates.map(rate => Math.abs(rate - middle))) * 100 / middle,
    minOpsPerSecond: Math.min(...rates), maxOpsPerSecond: Math.max(...rates),
    checksum: checksum.value, cpuMicroseconds, memoryBefore, memoryAfter: process.memoryUsage(), processMaxRssBytes: process.resourceUsage().maxRSS * 1024 };
}
const defaultCells = [
  ...['lock-normalized', 'lock-source', 'api-normalized', 'api-source', 'unicode'].flatMap(dataset => ['oracle', 'native', 'safe-stable', 'fast-stable'].map(method => [dataset, method])),
  ...['batch-tiny-32', 'batch-api-records-32'].flatMap(dataset => ['oracle-loop', 'native-loop', 'native-batch', 'public-loop', 'public-batch'].map(method => [dataset, method])),
  ...['oracle', 'public-stringify', 'cache-hit', 'cache-miss'].map(method => ['cache-api-document', method]),
];
function shuffled(items, seed) {
  const result = [...items];
  let state = seed >>> 0;
  for (let i = result.length - 1; i > 0; i--) {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    const j = (state >>> 0) % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function environment() {
  const files = ['benches/reproduction/run.cjs', 'js/index.ts', 'js/dist/index.js', 'native/binding.js', 'src/lib.rs', 'src/tree.rs', 'src/engine.rs', 'Cargo.lock', 'Cargo.toml', 'pnpm-lock.yaml'];
  const target = 'target/x86_64-pc-windows-msvc/release/stable_json_rs.dll';
  return { platform: process.platform, arch: process.arch, osRelease: os.release(), osVersion: os.version(), node: process.version, v8: process.versions.v8, processExecPath: process.execPath,
    cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length, totalMemoryBytes: os.totalmem(),
    rust: command('rustc', ['--version']), cargo: command('cargo', ['--version']), pnpm: command('pnpm.cmd', ['--version']),
    commit: command('git', ['rev-parse', 'HEAD']), dirty: command('git', ['status', '--short']), upstreamCommit: command('git', ['-C', 'upstream/fast-json-stable-stringify', 'rev-parse', 'HEAD']),
    napiOverride: process.env.NAPI_RS_NATIVE_LIBRARY_PATH || null, nodeOptions: process.env.NODE_OPTIONS || null,
    sourceHashes: Object.fromEntries(files.map(file => [file, sha(read(file))])),
    releaseArtifact: fs.existsSync(path.join(root, target)) ? { path: target, sha256: sha(read(target)) } : null,
    cpuPowerPlan: command('powercfg', ['/getactivescheme']),
    dependencies: Object.fromEntries(['safe-stable-stringify', 'fast-stable-stringify', '@napi-rs/cli'].map(name => [name, packageVersion(name)])) };
}
async function main() {
  const checkOnly = process.argv.includes('--check');
  const config = { runs: Number(process.env.REPRO_RUNS || 2), samples: Number(process.env.REPRO_SAMPLES || 9), sampleMs: Number(process.env.REPRO_SAMPLE_MS || 100), warmupMs: Number(process.env.REPRO_WARMUP_MS || 300), seed: Number(process.env.REPRO_SEED || 291947) };
  assert.ok(config.runs >= 2 && config.samples >= 9 && config.samples % 2 === 1 && config.sampleMs >= 100 && config.warmupMs >= 200, 'At least 2 runs, 9 odd samples, 100ms samples and 200ms warmup required');
  let cells = defaultCells;
  if (process.env.REPRO_DATASETS) cells = cells.filter(([dataset]) => process.env.REPRO_DATASETS.split(',').includes(dataset));
  if (process.env.REPRO_METHODS) cells = cells.filter(([, method]) => process.env.REPRO_METHODS.split(',').includes(method));
  assert.ok(cells.length > 0);
  const timestamp = new Date().toISOString();
  const report = { timestamp, command: `node benches/reproduction/run.cjs${checkOnly ? ' --check' : ''}`, config, selection: { datasets: process.env.REPRO_DATASETS || null, methods: process.env.REPRO_METHODS || null }, environment: environment(),
    fixtures: fixtures().sources.map(({ value, source, normalized, ...metadata }) => metadata),
    limitations: ['Local serial child processes, randomly shuffled order per run; uncontrolled CPU placement, OS scheduling, thermal state, power mode and GC.', 'RSS includes fixture loading/JSON parsing/native require/warmup. No serializer-only peak or allocation count.', 'Text cases include full public wrapper validation, napi UTF conversion, native processing and returned JS string. Input text prepared before timing. JS baselines parse and sort each operation.', 'Source fixtures preserve formatting and token spelling; exact result comparisons establish fixture-specific equivalence only. General text semantics differ.', 'Batch methods include identical JSON.stringify of returned array. Cache hits skip serialization under explicit caller version contract.'], results: [] };
  for (let run = 1; run <= (checkOnly ? 1 : config.runs); run++) {
    for (const [dataset, method] of shuffled(cells, config.seed + run)) {
      const child = spawnSync(process.execPath, [__filename, '--cell', dataset, method, JSON.stringify(config), ...(checkOnly ? ['--check'] : [])], { cwd: root, encoding: 'utf8', timeout: 120000 });
      if (child.status !== 0) throw new Error(`${dataset}/${method}: ${child.stderr || child.error?.message}`);
      const result = { run, ...JSON.parse(child.stdout) };
      report.results.push(result);
      console.log(`${run} ${dataset} ${method} ${checkOnly ? 'EXACT PASS' : `${result.medianOpsPerSecond.toFixed(1)} ops/s MAD${result.madPercent.toFixed(2)}%`}`);
    }
  }
  fs.mkdirSync(path.join(__dirname, 'results'), { recursive: true });
  const filename = path.join(__dirname, 'results', `${timestamp.replace(/[:.]/g, '-')}-${process.pid}${checkOnly ? '-checks' : ''}.json`);
  fs.writeFileSync(filename, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  console.log(path.relative(root, filename));
}
module.exports = { fixtures, prepare, shuffled, median };
if (require.main === module) {
  if (process.argv[2] === '--cell') cell(process.argv[3], process.argv[4], JSON.parse(process.argv[5]), process.argv.includes('--check')).then(result => process.stdout.write(JSON.stringify(result))).catch(error => { console.error(error); process.exitCode = 1; });
  else main().catch(error => { console.error(error); process.exitCode = 1; });
}
