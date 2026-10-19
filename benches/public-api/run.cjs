'use strict';
// Independent object-input comparison. Never imports an older benchmark harness.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const { createRequire } = require('node:module');
const { pathToFileURL } = require('node:url');
const { spawnSync, execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const median = values => [...values].sort((a, b) => a - b)[values.length >> 1];
const datasets = ['application-config', 'dependency-lock', 'public-api-document', 'upstream-api-fixture', 'cldr-bengali', 'api-comments-32', 'api-user'];
const methods = ['cjs-stringify', 'cjs-stableStringify', 'esm-stringify', 'esm-stableStringify', 'upstream', 'native-roundtrip'];
const batchMethods = ['batch-current', 'batch-original', 'loop-current'];
const textMethods = ['native-text', 'upstream-text', 'select-text', 'upstream-select-text'];
const selectionPaths = { 'dependency-lock': '/name', 'public-api-document': '/users/0/email', 'cldr-bengali': '/main/bn/localeDisplayNames/languages/en' };
function command(program, args) {
  try { return execFileSync(program, args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return 'UNAVAILABLE'; }
}
function fixtures() {
  const sources = [];
  for (const directory of ['benches/data', 'benches/profiling/data']) {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, directory, directory.endsWith('profiling/data') ? 'cldr-manifest.json' : 'manifest.json')));
    for (const item of manifest.filter(item => item.file.endsWith('.json'))) {
      const bytes = fs.readFileSync(path.join(root, directory, item.file));
      assert.equal(bytes.length, item.bytes);
      assert.equal(sha(bytes), item.sha256);
      const license = fs.readFileSync(path.join(root, directory, item.licenseFile));
      assert.ok(license.length > 100);
      sources.push({ ...item, directory, licenseSha256: sha(license), value: JSON.parse(bytes) });
    }
  }
  const value = name => sources.find(item => item.file === name).value;
  const api = value('jsonplaceholder-data.json');
  return { sources, values: {
    'application-config': value('typescript-package.json'),
    'dependency-lock': value('typescript-package-lock.json'),
    'public-api-document': api,
    'upstream-api-fixture': value('upstream-test.json'),
    'cldr-bengali': value('cldr-bn-languages.json'),
    'api-comments-32': api.comments.slice(0, 32),
    'api-user': api.users[0],
  } };
}
function nativeArtifacts() {
  return Object.keys(require.cache).filter(file => file.endsWith('.node')).map(file => ({ path: path.relative(root, file), sha256: sha(fs.readFileSync(file)) }));
}
async function prepare(dataset, method, candidate) {
  const batch = dataset === 'api-comments-batch32';
  const text = textMethods.includes(method);
  assert.ok(batch || datasets.includes(dataset));
  assert.ok((batch ? batchMethods : text ? textMethods : methods).includes(method));
  const candidateDirectory = path.resolve(root, method === 'batch-original' ? '.verification/final-output-ee4b51b' : candidate);
  const tarballs = fs.readdirSync(candidateDirectory).filter(file => file.endsWith('.tgz'));
  assert.equal(tarballs.length, 1);
  const localRequire = createRequire(path.join(candidateDirectory, 'npm/package.json'));
  const cjsEntry = localRequire.resolve('stable-json-rs');
  const packageDirectory = path.resolve(path.dirname(cjsEntry), '..');
  const packageJson = JSON.parse(fs.readFileSync(path.join(packageDirectory, 'package.json')));
  assert.equal(packageJson.exports['.'].require.default, './js/index.cjs');
  assert.equal(packageJson.exports['.'].import.default, './js/index.mjs');
  const cjs = localRequire('stable-json-rs');
  // Generated, ignored consumer uses a junction to the real installed package.
  // Node itself resolves its bare specifier and import export condition.
  const consumerDirectory = path.join(__dirname, 'consumers', sha(fs.readFileSync(path.join(candidateDirectory, tarballs[0]))));
  const linkedPackage = path.join(consumerDirectory, 'node_modules/stable-json-rs');
  fs.mkdirSync(path.dirname(linkedPackage), { recursive: true });
  fs.writeFileSync(path.join(consumerDirectory, 'package.json'), JSON.stringify({ name: 'stable-json-rs-benchmark-consumer', private: true, type: 'module' }));
  if (!fs.existsSync(linkedPackage)) fs.symlinkSync(packageDirectory, linkedPackage, 'junction');
  assert.equal(fs.realpathSync(linkedPackage), fs.realpathSync(packageDirectory));
  const esmEntry = path.join(consumerDirectory, 'index.mjs');
  fs.writeFileSync(esmEntry, "export * from 'stable-json-rs';\nexport const benchmarkResolvedEntry = import.meta.resolve('stable-json-rs');\n");
  const esm = await import(pathToFileURL(esmEntry).href);
  assert.equal(esm.benchmarkResolvedEntry, pathToFileURL(fs.realpathSync(path.join(packageDirectory, packageJson.exports['.'].import.default))).href);
  assert.equal(cjs.stringify, cjs.stableStringify);
  assert.equal(esm.stringify, esm.stableStringify);
  assert.equal(cjs.stringify, esm.stringify);
  assert.equal(nativeArtifacts().length, 0, 'Compatibility imports must remain native-lazy');
  const oraclePath = path.join(root, 'upstream/fast-json-stable-stringify/index.js');
  const oracle = require(oraclePath);
  const { sources, values } = fixtures();
  const value = batch ? values['api-comments-32'] : values[dataset];
  let expected = batch ? value.map(item => oracle(item)) : oracle(value);
  const inputJson = JSON.stringify(value); // Metadata only; native-roundtrip repeats conversion inside timing.
  const pointer = method.includes('select') ? selectionPaths[dataset] : undefined;
  const select = object => pointer.slice(1).split('/').reduce((current, key) => current[key], object);
  if (pointer) {
    assert.notEqual(select(value), undefined, 'Real selection path must exist');
    expected = JSON.stringify(select(value));
  }
  let fn;
  if (batch) {
    const inputs = value.map(item => JSON.stringify(item));
    fn = method === 'loop-current' ? () => inputs.map(input => cjs.stringifyJson(input)) : () => cjs.stringifyJsonBatch(inputs);
  } else if (method === 'native-text') fn = () => cjs.stringifyJson(inputJson);
  else if (method === 'upstream-text') fn = () => oracle(JSON.parse(inputJson));
  else if (method === 'select-text') fn = () => cjs.selectJson(inputJson, pointer);
  else if (method === 'upstream-select-text') fn = () => JSON.stringify(select(JSON.parse(inputJson)));
  else if (method === 'cjs-stringify') fn = () => cjs.stringify(value);
  else if (method === 'cjs-stableStringify') fn = () => cjs.stableStringify(value);
  else if (method === 'esm-stringify') fn = () => esm.stringify(value);
  else if (method === 'esm-stableStringify') fn = () => esm.stableStringify(value);
  else if (method === 'upstream') fn = () => oracle(value);
  else fn = () => cjs.stringifyJson(JSON.stringify(value));
  assert.deepEqual(fn(), expected, `${dataset}/${method}: exact stable output`);
  const usesNative = method === 'native-roundtrip' || method === 'native-text' || method === 'select-text' || batch;
  if (!usesNative) assert.equal(nativeArtifacts().length, 0);
  else assert.equal(nativeArtifacts().length, 1);
  const sourceHashes = Object.fromEntries(['js/index.cjs', 'js/index.mjs', 'js/dist/index.js', 'native/binding.js', 'package.json'].map(file => [file, sha(fs.readFileSync(path.join(packageDirectory, file)))]));
  const tarball = path.join(candidateDirectory, tarballs[0]);
  for (const [file, expectedSha] of Object.entries(sourceHashes)) {
    assert.equal(sha(execFileSync('tar', ['-xzOf', tarball, `package/${file}`], { maxBuffer: 8 * 1024 * 1024 })), expectedSha, 'Installed source matches actual packed bytes');
  }
  for (const artifact of nativeArtifacts()) {
    assert.equal(sha(execFileSync('tar', ['-xzOf', tarball, `package/native/${path.basename(artifact.path)}`], { maxBuffer: 16 * 1024 * 1024 })), artifact.sha256, 'Actual loaded addon matches packed bytes');
  }
  const releasePath = path.join(root, 'target/x86_64-pc-windows-msvc/release/stable_json_rs.dll');
  const releaseArtifact = process.platform === 'win32' && nativeArtifacts().length ? { path: path.relative(root, releasePath), sha256: sha(fs.readFileSync(releasePath)) } : null;
  if (releaseArtifact) assert.equal(nativeArtifacts()[0].sha256, releaseArtifact.sha256, 'Actual native addon equals the compiled release artifact');
  const upstreamCommit = command('git', ['-C', 'upstream/fast-json-stable-stringify', 'rev-parse', 'HEAD']);
  assert.equal(upstreamCommit, '49e230da2c84247b29ad4de02c9395793caefd15');
  return { fn, expected, metadata: {
    dataset, method, inputBytes: Buffer.byteLength(inputJson), inputSha256: sha(inputJson), selectionPath: pointer,
    outputBytes: batch ? expected.reduce((sum, output) => sum + Buffer.byteLength(output), 0) : Buffer.byteLength(expected), outputSha256: sha(batch ? JSON.stringify(expected) : expected),
    packageDirectory: path.relative(root, packageDirectory), packageVersion: packageJson.version,
    candidate: path.relative(root, candidateDirectory), tarballSha256: sha(fs.readFileSync(tarball)), packedRuntimeBytesVerified: true,
    packageSourceHashes: sourceHashes, upstreamSourceSha256: sha(fs.readFileSync(oraclePath)),
    upstreamCommit, esmResolvedEntry: esm.benchmarkResolvedEntry,
    native: nativeArtifacts(), releaseArtifact,
    sources: sources.map(({ value: unused, ...source }) => source),
    usesNative, semantics: text ? pointer ? 'Existing normalized JSON text to raw selected JSON string. Native whole-input guards/validation/boundary/return versus JSON.parse + same field selection + JSON.stringify, exactly equal for this fixture.' : 'Existing normalized JSON text to sorted JSON string. Native wrapper/guard/boundary/return versus JSON.parse + upstream. NOT an object-input stringify operation.' : batch ? '32 existing real comment JSON strings to ordered exact strings. Full public wrapper validation, native input/output conversion and per-returned-element consumption included.' : method === 'native-roundtrip' ? 'Same exact result for this JSON-only fixture; conversion and native wrapper/boundary/return included. Not compatible for arbitrary live JS values.' : 'Same live JavaScript object to exact upstream-compatible string; public entry dispatch included; no native conversion or fallback preprocessing.',
  } };
}
function shuffled(items, seed) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
async function worker(dataset, method, candidate) {
  const prepared = await prepare(dataset, method, candidate);
  if (process.env.PUBLIC_API_CHECK_ONLY === '1') return { ...prepared.metadata, exact: true, timed: false };
  const warmupMs = Number(process.env.PUBLIC_API_WARMUP_MS || 1000);
  const sampleMs = Number(process.env.PUBLIC_API_SAMPLE_MS || 100);
  const count = Number(process.env.PUBLIC_API_SAMPLES || 9);
  assert.ok(warmupMs >= 1000 && sampleMs >= 100 && Number.isInteger(count) && count >= 9 && count % 2 === 1, 'Acceptance requires >=1s warmup and >=9 odd samples of >=100ms');
  let checksum = 0;
  function interval(ms) {
    const started = performance.now();
    let operations = 0;
    do {
      for (let i = 0; i < 8; i++) {
        const output = prepared.fn();
        if (Array.isArray(output)) {
          for (const element of output) checksum = (checksum + element.length + element.charCodeAt(element.length >>> 1)) >>> 0;
        } else checksum = (checksum + output.length + output.charCodeAt(output.length >>> 1)) >>> 0;
      }
      operations += 8;
    } while (performance.now() - started < ms);
    const elapsedMs = performance.now() - started;
    return { operations, elapsedMs, opsPerSecond: operations * 1000 / elapsedMs };
  }
  interval(warmupMs);
  const cpuStart = process.cpuUsage();
  const samples = Array.from({ length: count }, () => interval(sampleMs));
  const cpu = process.cpuUsage(cpuStart);
  assert.deepEqual(prepared.fn(), prepared.expected);
  if (!prepared.metadata.usesNative) assert.equal(nativeArtifacts().length, 0);
  const rates = samples.map(sample => sample.opsPerSecond);
  const center = median(rates);
  const mad = median(rates.map(rate => Math.abs(rate - center)));
  return { ...prepared.metadata, exact: true, timed: true, config: { warmupMs, sampleMs, count, consumption: 'length + middle UTF16 code unit; forces access to constructed rope string' }, samples,
    medianOpsPerSecond: center, madOpsPerSecond: mad, madPercent: mad / center * 100,
    latencyMicroseconds: 1e6 / center, outputMiBPerSecond: center * prepared.metadata.outputBytes / 1048576,
    checksum, cpuMicroseconds: cpu, memory: process.memoryUsage(), resourceUsage: process.resourceUsage(), nativeAfter: nativeArtifacts(),
  };
}
async function main() {
  assert.ok(process.env.PUBLIC_API_CHECK_ONLY === '1' || process.env.PUBLIC_API_CANDIDATE,
    'Set PUBLIC_API_CANDIDATE explicitly to a verified installed candidate before timing');
  const candidate = process.env.PUBLIC_API_CANDIDATE || '.verification/final-output-ee4b51b';
  if (process.argv[2] === '--worker') {
    process.stdout.write(JSON.stringify(await worker(process.argv[3], process.argv[4], candidate)));
    return;
  }
  const batch = process.env.PUBLIC_API_BATCH === '1';
  const text = process.env.PUBLIC_API_TEXT === '1';
  const selectedDatasets = process.env.PUBLIC_API_DATASETS ? process.env.PUBLIC_API_DATASETS.split(',') : batch ? ['api-comments-batch32'] : text ? Object.keys(selectionPaths) : datasets;
  const selectedMethods = process.env.PUBLIC_API_METHODS ? process.env.PUBLIC_API_METHODS.split(',') : batch ? batchMethods : text ? textMethods : methods;
  const repetitions = Number(process.env.PUBLIC_API_RUNS || 2);
  const snapshotBytes = fs.readFileSync(__filename);
  const snapshotSha256 = sha(snapshotBytes);
  const snapshot = path.join(__dirname, `run-${snapshotSha256.slice(0, 12)}.cjs`);
  if (!fs.existsSync(snapshot)) fs.writeFileSync(snapshot, snapshotBytes);
  const startedAt = new Date().toISOString();
  const report = {
    schemaVersion: 1, startedAt, runner: path.relative(root, snapshot), runnerSha256: snapshotSha256,
    candidate, configuration: { selectedDatasets, selectedMethods, repetitions, serial: true, warmupMs: Number(process.env.PUBLIC_API_WARMUP_MS || 1000), sampleMs: Number(process.env.PUBLIC_API_SAMPLE_MS || 100), samples: Number(process.env.PUBLIC_API_SAMPLES || 9) },
    invocation: { argv: process.argv, environment: Object.fromEntries(Object.entries(process.env).filter(([name]) => name.startsWith('PUBLIC_API_'))) },
    environment: { node: process.version, v8: process.versions.v8, executable: process.execPath, nodeOptions: process.env.NODE_OPTIONS || null, execArgv: process.execArgv, platform: process.platform, arch: process.arch, os: os.version(), release: os.release(), cpu: os.cpus()[0], logicalCpus: os.cpus().length, totalMemory: os.totalmem(), rust: command('rustc', ['--version']), gitCommit: command('git', ['rev-parse', 'HEAD']), gitStatus: command('git', ['status', '--short']) },
    results: [],
  };
  for (let run = 1; run <= repetitions; run++) {
    const cells = shuffled(selectedDatasets.flatMap(dataset => selectedMethods.map(method => ({ dataset, method }))), 20261019 + run);
    for (const cell of cells) {
      const result = spawnSync(process.execPath, [snapshot, '--worker', cell.dataset, cell.method], { cwd: root, encoding: 'utf8', env: process.env, maxBuffer: 8 * 1024 * 1024 });
      assert.equal(result.status, 0, `${cell.dataset}/${cell.method}: ${result.stderr}`);
      report.results.push({ run, ...JSON.parse(result.stdout) });
      process.stderr.write(`${run} ${cell.dataset}/${cell.method}: ${report.results.at(-1).medianOpsPerSecond?.toFixed(1) || 'checked'}\n`);
    }
  }
  report.finishedAt = new Date().toISOString();
  const directory = path.join(__dirname, 'results');
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, `${startedAt.replace(/[:.]/g, '-')}-${process.pid}${process.env.PUBLIC_API_CHECK_ONLY === '1' ? '-checks' : ''}.json`);
  fs.writeFileSync(file, JSON.stringify(report, null, 2), { flag: 'wx' });
  console.log(path.relative(root, file));
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { fixtures, prepare, datasets, methods, batchMethods, textMethods, selectionPaths, median, shuffled };
