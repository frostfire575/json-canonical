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
    const sourceText = bytes.toString('utf8');
    const value = JSON.parse(sourceText);
    const normalized = JSON.stringify(value);
    return { ...item, value, sourceText, normalized, normalizedBytes: Buffer.byteLength(normalized), normalizedSha256: sha(normalized) };
  });
  const cldrManifestPath = 'benches/profiling/data/cldr-manifest.json';
  if (fs.existsSync(path.join(root, cldrManifestPath))) {
    const cldrManifest = JSON.parse(read(cldrManifestPath));
    for (const item of cldrManifest) {
      const bytes = read(`benches/profiling/data/${item.file}`);
      assert.equal(bytes.length, item.bytes, item.file);
      assert.equal(sha(bytes), item.sha256, item.file);
    }
    const item = cldrManifest.find(item => item.file === 'cldr-bn-languages.json');
    assert.ok(item, 'Real CLDR Bengali fixture metadata required');
    const sourceText = read(`benches/profiling/data/${item.file}`).toString('utf8');
    const value = JSON.parse(sourceText);
    const normalized = JSON.stringify(value);
    sources.push({ ...item, fixtureDirectory: 'benches/profiling/data', value, sourceText, normalized, normalizedBytes: Buffer.byteLength(normalized), normalizedSha256: sha(normalized) });
  }
  const fixture = name => sources.find(item => item.file === name);
  const unicode = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`বাংলা😀${i}`, '日本語\nالعربية\\বাংলা😀'.repeat(8)]));
  const tinyBatch = Array.from({ length: 32 }, (_, i) => ({ z: i, a: { state: true, message: `row ${i}` } }));
  const api = fixture('jsonplaceholder-data.json');
  let deep = { leaf: true };
  for (let i = 0; i < 80; i++) deep = { z: i, a: deep };
  const records = Array.from({ length: 600 }, (_, i) => ({ id: i, name: `record ${i}`, active: i % 2 === 0, tags: ['api', 'json'], meta: { rank: i / 7 } }));
  return { sources, inputs: {
    'tiny': JSON.stringify({ z: 1, a: true, m: 'hello' }),
    'latin1-large': JSON.stringify({ value: 'é'.repeat(16000) }),
    'sparse-unicode': JSON.stringify({ value: 'x'.repeat(50000) + '😀' }),
    'ascii-string-50k': JSON.stringify({ value: 'x'.repeat(50000) }),
    'short-unicode': JSON.stringify({ value: 'বাংলা😀漢字é' }),
    ...(fixture('cldr-bn-languages.json') ? { 'real-cldr-bn': fixture('cldr-bn-languages.json').normalized } : {}),
    'deep': JSON.stringify(deep),
    'wide': JSON.stringify(Object.fromEntries(Array.from({ length: 1500 }, (_, i) => [`key-${1500 - i}`, i]))),
    'application-config': fixture('typescript-package.json').normalized,
    'upstream-api-fixture': fixture('upstream-test.json').normalized,
    'large-string': JSON.stringify({ z: 'x'.repeat(150000), a: 'line\nquote"'.repeat(1000) }),
    'record-array': JSON.stringify(records),
    'backend-payload': JSON.stringify({ status: 'ok', pagination: { limit: 600, next: null }, data: records, request: { method: 'GET', path: '/api/records' } }),
    'array-of-32': JSON.stringify(tinyBatch),
    'lock-normalized': fixture('typescript-package-lock.json').normalized,
    'lock-source': fixture('typescript-package-lock.json').sourceText,
    'api-normalized': api.normalized,
    'api-source': api.sourceText,
    'unicode': JSON.stringify(unicode),
    'batch-tiny-32': tinyBatch.map(value => JSON.stringify(value)),
    'batch-api-records-32': api.value.comments.slice(0, 32).map(value => JSON.stringify(value)),
    'cache-api-document': api.value,
    ...Object.fromEntries([1, 8, 32, 128].map(count => [`batch-api-elements-${count}`, api.value.comments.slice(0, count).map(value => JSON.stringify(value))])),
  } };
}
function preparePool(dataset, method) {
  const match = /^cache-pool-(32|128)-hit(0|50|90|99)$/.exec(dataset);
  assert.ok(match, dataset);
  const size = Number(match[1]);
  const hitPercent = Number(match[2]);
  const api = require(path.join(root, 'js/index.cjs'));
  const oracle = require(path.join(root, 'upstream/fast-json-stable-stringify'));
  const original = fixtures().sources.find(source => source.file === 'jsonplaceholder-data.json').value.comments.slice(0, size);
  function sequence(serializer) {
    const records = original.map(value => ({ ...value }));
    const versions = records.map(() => 1);
    const cache = api.createSerializerCache();
    if (serializer === 'cache-pool') for (const record of records) cache.stringify(record, 1);
    let step = 0;
    return () => {
      const index = step % size;
      const miss = step % 100 >= hitPercent;
      const record = records[index];
      if (miss) {
        versions[index]++;
        record.body = `${original[index].body}:${versions[index]}`;
      }
      step++;
      if (serializer === 'cache-pool') return cache.stringify(record, versions[index]);
      if (serializer === 'public-pool') return api.stringify(record);
      if (serializer === 'oracle-pool') return oracle(record);
      throw new Error(`Unknown pool serializer ${serializer}`);
    };
  }
  // Validate full mutation/version trace using separate identical initial states.
  const expectedSequence = sequence('oracle-pool');
  const actualSequence = sequence(method);
  for (let i = 0; i < 400; i++) assert.equal(actualSequence(), expectedSequence(), `pool trace ${dataset}/${method} step${i}`);
  const firstSequence = sequence('oracle-pool');
  return { fn: sequence(method), expected: firstSequence(), units: 1,
    inputBytes: Buffer.byteLength(JSON.stringify(original)), inputSha256: sha(JSON.stringify(original)),
    cachePool: { size, plannedHitPercent: hitPercent, checkedSteps: 400, trace: 'round-robin identity pool; step%100 >= hitPercent mutates body and increments explicit per-record version; both candidates include scheduling/version/mutation cost; cache prefilled outside timing; no automatic detection' } };
}
function prepare(dataset, method) {
  const { inputs } = fixtures();
  if (dataset.startsWith('cache-pool-')) {
    const prepared = preparePool(dataset, method);
    const api = require(path.join(root, 'js/index.cjs'));
    api.stringifyJson('{}');
    return { ...prepared, native: Object.keys(require.cache).filter(file => file.endsWith('.node')).map(file => ({ path: path.relative(root, file), sha256: sha(fs.readFileSync(file)) })) };
  }
  const input = inputs[dataset];
  assert.notEqual(input, undefined, dataset);
  const oracle = require(path.join(root, 'upstream/fast-json-stable-stringify'));
  const api = require(path.join(root, 'js/index.cjs'));
  const isBatch = Array.isArray(input);
  const isCache = dataset.startsWith('cache-');
  let expected = isCache ? oracle(input) : isBatch ? JSON.stringify(input.map(text => oracle(JSON.parse(text)))) : oracle(JSON.parse(input));
  let fn;
  let scalarOutput = false;
  let arrayOutput = false;
  let comparableStableOperation = true;
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
    else if (method === 'native-batch-elements' || method === 'native-loop-elements' || method === 'oracle-loop-elements') {
      arrayOutput = true;
      expected = input.map(text => oracle(JSON.parse(text)));
      if (method === 'native-batch-elements') fn = () => api.stringifyJsonBatch(input);
      else if (method === 'native-loop-elements') fn = () => input.map(text => api.stringifyJson(text));
      else fn = () => input.map(text => oracle(JSON.parse(text)));
    }
  } else {
    if (method === 'native') fn = () => api.stringifyJson(input);
    else if (method === 'oracle') fn = () => oracle(JSON.parse(input));
    else if (method === 'safe-stable' || method === 'fast-stable') {
      const stringify = require(method === 'safe-stable' ? 'safe-stable-stringify' : 'fast-stable-stringify');
      fn = () => stringify(JSON.parse(input));
    }
    else if (['object-oracle', 'object-public', 'object-native-roundtrip', 'object-safe-stable', 'object-fast-stable', 'JSON-context'].includes(method)) {
      const value = JSON.parse(input);
      if (method === 'object-oracle') fn = () => oracle(value);
      else if (method === 'object-public') fn = () => api.stringify(value);
      else if (method === 'object-native-roundtrip') fn = () => api.stringifyJson(JSON.stringify(value));
      else if (method === 'JSON-context') { fn = () => JSON.stringify(value); expected = JSON.stringify(value); comparableStableOperation = false; }
      else {
        const stringify = require(method === 'object-safe-stable' ? 'safe-stable-stringify' : 'fast-stable-stringify');
        fn = () => stringify(value);
      }
    }
    else if (method.startsWith('select-')) {
      const pointers = { tiny: '/a', 'lock-normalized': '/name', 'api-normalized': '/users/0/email', unicode: '/বাংলা😀0', deep: '/a'.repeat(80) + '/leaf', wide: '/key-1500' };
      const pointer = pointers[dataset];
      assert.notEqual(pointer, undefined, `No selection path for ${dataset}`);
      const segments = pointer.slice(1).split('/').map(part => part.replace(/~1/g, '/').replace(/~0/g, '~'));
      const lookup = value => { for (const segment of segments) value = value?.[segment]; return value; };
      const selected = lookup(JSON.parse(input));
      scalarOutput = method.endsWith('-scalar');
      expected = scalarOutput ? selected : JSON.stringify(selected);
      if (method === 'select-native-text') fn = () => api.selectJson(input, pointer);
      else if (method === 'select-oracle-text') fn = () => JSON.stringify(lookup(JSON.parse(input)));
      else if (method === 'select-native-scalar') fn = () => JSON.parse(api.selectJson(input, pointer));
      else if (method === 'select-oracle-scalar') fn = () => lookup(JSON.parse(input));
    }
  }
  assert.equal(typeof fn, 'function', `${dataset}/${method}`);
  // Load the real native addon and establish its identity, even for JS candidates.
  api.stringifyJson('{}');
  const native = Object.keys(require.cache).filter(file => file.endsWith('.node')).map(file => ({ path: path.relative(root, file), sha256: sha(fs.readFileSync(file)) }));
  assert.equal(native.length, 1, 'Exactly one actual native addon must be loaded');
  const actual = fn();
  assert.deepEqual(actual, expected, `${dataset}/${method}: exact output`);
  return { fn, expected, native, scalarOutput, arrayOutput, comparableStableOperation, inputBytes: isCache ? Buffer.byteLength(JSON.stringify(input)) : isBatch ? input.reduce((sum, text) => sum + Buffer.byteLength(text), 0) : Buffer.byteLength(input), inputSha256: sha(isCache || isBatch ? JSON.stringify(input) : input), units: isBatch ? input.length : 1 };
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
function runForLength(fn, milliseconds, checksumState) {
  let iterations = 0;
  const started = performance.now();
  do {
    for (let i = 0; i < 16; i++) {
      checksumState.value = (checksumState.value + fn().length) >>> 0;
      iterations++;
    }
  } while (performance.now() - started < milliseconds);
  const elapsedMs = performance.now() - started;
  return { iterations, elapsedMs, opsPerSecond: iterations * 1000 / elapsedMs };
}
function runForArray(fn, milliseconds, checksumState, flatten = true) {
  let iterations = 0;
  const started = performance.now();
  do {
    for (let i = 0; i < 16; i++) {
      const output = fn();
      for (let index = 0; index < output.length; index++) {
        const result = output[index];
        checksumState.value = (checksumState.value + result.length + (flatten ? result.charCodeAt(result.length >>> 1) : 0)) >>> 0;
      }
      iterations++;
    }
  } while (performance.now() - started < milliseconds);
  const elapsedMs = performance.now() - started;
  return { iterations, elapsedMs, opsPerSecond: iterations * 1000 / elapsedMs };
}
function runForScalar(fn, milliseconds, checksumState) {
  let iterations = 0;
  const started = performance.now();
  do {
    for (let i = 0; i < 16; i++) {
      const value = fn();
      checksumState.value = (checksumState.value + (typeof value === 'string' ? value.length + value.charCodeAt(value.length >>> 1) : typeof value === 'number' ? value + 31 : value ? 23 : 29)) >>> 0;
      iterations++;
    }
  } while (performance.now() - started < milliseconds);
  const elapsedMs = performance.now() - started;
  return { iterations, elapsedMs, opsPerSecond: iterations * 1000 / elapsedMs };
}
async function cell(dataset, method, config, checkOnly = false) {
  const prepared = prepare(dataset, method);
  const rendered = typeof prepared.expected === 'string' ? prepared.expected : JSON.stringify(prepared.expected);
  const base = { dataset, method, exactOutputVerified: true, outputSha256: sha(rendered), outputBytes: Buffer.byteLength(rendered), inputBytes: prepared.inputBytes, inputSha256: prepared.inputSha256, unitsPerOperation: prepared.units, nativeArtifacts: prepared.native,
    scalarOutput: prepared.scalarOutput || false, arrayOutput: prepared.arrayOutput || false, cachePool: prepared.cachePool,
    comparableStableOperation: prepared.comparableStableOperation ?? true, outputHashContract: prepared.cachePool ? 'first result from independent initial state; entire 400-step trace checked' : 'exact returned string or JSON.stringify of non-string result',
    inputHashContract: 'actual single JSON-text bytes, or JSON.stringify of batch/object/cache-pool inputs' };
  if (checkOnly) return base;
  const checksum = { value: 0 };
  const measure = prepared.scalarOutput ? runForScalar : prepared.arrayOutput ? (fn, milliseconds, state) => runForArray(fn, milliseconds, state, config.consumption !== 'length') : config.consumption === 'length' ? runForLength : runFor;
  const warmup = measure(prepared.fn, config.warmupMs, checksum);
  const memoryBefore = process.memoryUsage();
  const cpuStart = process.cpuUsage();
  const samples = [];
  for (let i = 0; i < config.samples; i++) {
    await new Promise(resolve => setImmediate(resolve));
    samples.push(measure(prepared.fn, config.sampleMs, checksum));
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
const textWorkloads = ['tiny', 'deep', 'wide', 'application-config', 'upstream-api-fixture', 'large-string', 'record-array', 'backend-payload', 'lock-normalized', 'api-normalized', 'unicode', 'array-of-32', 'latin1-large', 'sparse-unicode', 'ascii-string-50k', 'short-unicode', 'real-cldr-bn'];
const extraCells = [
  ...textWorkloads.filter(dataset => !dataset.startsWith('batch-')).flatMap(dataset => ['oracle', 'native', 'safe-stable', 'fast-stable', 'object-oracle', 'object-public', 'object-native-roundtrip', 'object-safe-stable', 'object-fast-stable', 'JSON-context'].map(method => [dataset, method])),
  ...['tiny', 'deep', 'wide', 'lock-normalized', 'api-normalized', 'unicode'].flatMap(dataset => ['select-native-text', 'select-oracle-text', 'select-native-scalar', 'select-oracle-scalar'].map(method => [dataset, method])),
  ...[1, 8, 32, 128].flatMap(count => ['native-batch-elements', 'native-loop-elements', 'oracle-loop-elements'].map(method => [`batch-api-elements-${count}`, method])),
  ...[32, 128].flatMap(size => [0, 50, 90, 99].flatMap(hitPercent => ['cache-pool', 'public-pool', 'oracle-pool'].map(method => [`cache-pool-${size}-hit${hitPercent}`, method]))),
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
  const files = ['benches/reproduction/run.cjs', 'js/index.ts', 'js/dist/index.js', 'js/index.cjs', 'js/index.mjs', 'native/binding.js', 'native/binding.d.ts', 'src/lib.rs', 'src/tree.rs', 'src/engine.rs', 'src/selection.rs', 'src/output.rs', 'build.rs', 'Cargo.lock', 'Cargo.toml', 'pnpm-lock.yaml', 'package.json', 'tsconfig.json'];
  const nativeSources = ['src/lib.rs', 'src/tree.rs', 'src/engine.rs', 'src/selection.rs', 'src/output.rs', 'build.rs', 'Cargo.toml'];
  const target = 'target/x86_64-pc-windows-msvc/release/stable_json_rs.dll';
  return { platform: process.platform, arch: process.arch, osRelease: os.release(), osVersion: os.version(), node: process.version, v8: process.versions.v8, processExecPath: process.execPath,
    cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length, totalMemoryBytes: os.totalmem(),
    rust: command('rustc', ['--version']), cargo: command('cargo', ['--version']), pnpm: process.platform === 'win32' ? command('cmd.exe', ['/d', '/s', '/c', 'pnpm --version']) : command('pnpm', ['--version']),
    commit: command('git', ['rev-parse', 'HEAD']), dirty: command('git', ['status', '--short']), upstreamCommit: command('git', ['-C', 'upstream/fast-json-stable-stringify', 'rev-parse', 'HEAD']),
    napiOverride: process.env.NAPI_RS_NATIVE_LIBRARY_PATH || null, nodeOptions: process.env.NODE_OPTIONS || null,
    sourceHashes: Object.fromEntries(files.map(file => [file, sha(read(file))])),
    embeddedNativeSources: Object.fromEntries(nativeSources.map(file => [file, read(file).toString('utf8')])),
    releaseArtifact: fs.existsSync(path.join(root, target)) ? { path: target, sha256: sha(read(target)) } : null,
    cpuPowerPlan: command('powercfg', ['/getactivescheme']),
    dependencies: Object.fromEntries(['safe-stable-stringify', 'fast-stable-stringify', '@napi-rs/cli'].map(name => [name, packageVersion(name)])) };
}
async function main() {
  const checkOnly = process.argv.includes('--check');
  const config = { runs: Number(process.env.REPRO_RUNS || 2), samples: Number(process.env.REPRO_SAMPLES || 9), sampleMs: Number(process.env.REPRO_SAMPLE_MS || 100), warmupMs: Number(process.env.REPRO_WARMUP_MS || 300), seed: Number(process.env.REPRO_SEED || 291947), consumption: process.env.REPRO_CONSUMPTION || 'flatten' };
  assert.ok(config.runs >= 2 && config.samples >= 9 && config.samples % 2 === 1 && config.sampleMs >= 100 && config.warmupMs >= 200, 'At least 2 runs, 9 odd samples, 100ms samples and 200ms warmup required');
  assert.ok(['flatten', 'length'].includes(config.consumption), 'REPRO_CONSUMPTION must be flatten or length');
  let cells = defaultCells;
  if (process.env.REPRO_DATASETS) {
    const unique = new Map([...defaultCells, ...extraCells].map(cell => [cell.join('/'), cell]));
    cells = [...unique.values()].filter(([dataset]) => process.env.REPRO_DATASETS.split(',').includes(dataset));
  }
  if (process.env.REPRO_METHODS) cells = cells.filter(([, method]) => process.env.REPRO_METHODS.split(',').includes(method));
  assert.ok(cells.length > 0);
  const timestamp = new Date().toISOString();
  const report = { timestamp, command: `node benches/reproduction/run.cjs${checkOnly ? ' --check' : ''}`, config, selection: { datasets: process.env.REPRO_DATASETS || null, methods: process.env.REPRO_METHODS || null }, environment: environment(),
    fixtures: fixtures().sources.map(({ value, sourceText, normalized, ...metadata }) => metadata),
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
