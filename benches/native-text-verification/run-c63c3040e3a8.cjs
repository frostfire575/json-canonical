'use strict';
// Independent installed native-text experiment; no other benchmark runner imported.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { createRequire } = require('node:module');
const { performance } = require('node:perf_hooks');
const { execFileSync, spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const primaryMethods = ['sort-native', 'sort-js', 'select-native', 'select-js'];
const methods = [...primaryMethods, 'select-direct-js'];
const definitions = [
  ['lock-original', 'typescript-package-lock.json', '/name'],
  ['config-original', 'typescript-package.json', '/name'],
  ['api-original', 'jsonplaceholder-data.json', '/users/0/email'],
  ['upstream-original', 'upstream-test.json', '/0/email'],
  ['cldr-original', 'cldr-bn-languages.json', '/main/bn/localeDisplayNames/languages/en'],
  ['lock-normalized', 'typescript-package-lock.json', '/name', 'normalized'],
  ['api-normalized', 'jsonplaceholder-data.json', '/users/0/email', 'normalized'],
  ['cldr-normalized', 'cldr-bn-languages.json', '/main/bn/localeDisplayNames/languages/en', 'normalized'],
  ['api-user-small', 'jsonplaceholder-data.json', '/email', 'first-user'],
];
function command(executable, args) {
  try { return execFileSync(executable, args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return 'UNAVAILABLE'; }
}
function median(numbers) {
  assert.ok(numbers.length && numbers.every(Number.isFinite));
  const sorted = numbers.toSorted((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
function shuffle(values, initial) {
  const copy = [...values]; let state = initial >>> 0;
  for (let i = copy.length - 1; i; i--) {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    const j = state % (i + 1); [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
function fixtures() {
  const sources = [];
  for (const [directory, filename] of [['benches/data', 'manifest.json'], ['benches/profiling/data', 'cldr-manifest.json']]) {
    for (const entry of JSON.parse(fs.readFileSync(path.join(root, directory, filename)))) {
      if (!entry.file.endsWith('.json')) continue;
      const bytes = fs.readFileSync(path.join(root, directory, entry.file));
      assert.equal(bytes.byteLength, entry.bytes);
      assert.equal(hash(bytes), entry.sha256, `Pinned fixture ${entry.file}`);
      const license = fs.readFileSync(path.join(root, directory, entry.licenseFile));
      assert.ok(license.length > 100);
      sources.push({ ...entry, directory, licenseSha256: hash(license), text: bytes.toString('utf8') });
    }
  }
  assert.equal(sources.length, 5);
  const cases = Object.fromEntries(definitions.map(([id, file, pointer, transform]) => {
    const source = sources.find(entry => entry.file === file);
    const parsed = JSON.parse(source.text);
    const input = transform === 'normalized' ? JSON.stringify(parsed) : transform === 'first-user' ? JSON.stringify(parsed.users[0]) : source.text;
    return [id, { id, input, pointer, source: file, transform: transform || 'none; original pinned bytes' }];
  }));
  return { sources: sources.map(({ text, ...entry }) => entry), cases };
}
function lookup(object, pointer) {
  return pointer === '' ? object : pointer.slice(1).split('/').reduce((value, segment) => value?.[segment.replace(/~1/g, '/').replace(/~0/g, '~')], object);
}
function directSelector(id) {
  if (id.startsWith('lock-') || id === 'config-original') return value => value.name;
  if (id === 'api-original' || id === 'api-normalized') return value => value.users[0].email;
  if (id === 'upstream-original') return value => value[0].email;
  if (id.startsWith('cldr-')) return value => value.main.bn.localeDisplayNames.languages.en;
  if (id === 'api-user-small') return value => value.email;
  throw new Error(`No explicit selector for ${id}`);
}
function packed(candidate) {
  assert.ok(candidate, 'NATIVE_TEXT_CANDIDATE is required, including check-only runs');
  const directory = path.resolve(root, candidate);
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'candidate.json')));
  assert.equal(manifest.schemaVersion, 2);
  assert.equal(path.basename(manifest.filename), manifest.filename);
  const tarball = path.join(directory, manifest.filename);
  assert.equal(hash(fs.readFileSync(tarball)), manifest.sha256, 'Actual archive matches manifest');
  const requireInstalled = createRequire(path.join(directory, 'npm/package.json'));
  const entry = requireInstalled.resolve('stable-json-rs');
  const packageDirectory = path.resolve(path.dirname(entry), '..');
  assert.equal(fs.realpathSync(packageDirectory), fs.realpathSync(path.join(directory, 'npm/node_modules/stable-json-rs')), 'Actual installed bare package');
  const identities = {};
  for (const [filename, identity] of Object.entries(manifest.files)) {
    const archiveBytes = execFileSync('tar', ['-xzOf', tarball, `package/${filename}`], { maxBuffer: 16 * 1024 * 1024 });
    assert.equal(archiveBytes.length, identity.bytes);
    assert.equal(hash(archiveBytes), identity.sha256, `Packed ${filename}`);
    const installedBytes = fs.readFileSync(path.join(packageDirectory, filename));
    assert.equal(hash(installedBytes), identity.sha256, `Installed ${filename}`);
    identities[filename] = identity;
  }
  const api = requireInstalled('stable-json-rs');
  assert.equal(api.stringifyJson.length, 2);
  return { api, packageDirectory, metadata: { candidate: path.relative(root, directory), tarball: path.relative(root, tarball), tarballSha256: manifest.sha256, manifestSha256: hash(fs.readFileSync(path.join(directory, 'candidate.json'))), manifestGitCommit: manifest.gitCommit, packedInstalledFiles: identities } };
}
function nativeArtifacts() {
  return Object.keys(require.cache).filter(filename => filename.endsWith('.node')).map(filename => ({ path: path.relative(root, filename), sha256: hash(fs.readFileSync(filename)) }));
}
function prepare(id, method, candidate) {
  assert.ok(methods.includes(method));
  const all = fixtures(); const fixture = all.cases[id]; assert.ok(fixture, id);
  const installed = packed(candidate);
  assert.deepEqual(nativeArtifacts(), [], 'Import must remain native lazy');
  const oraclePath = path.join(root, 'upstream/fast-json-stable-stringify/index.js');
  const oracle = require(oraclePath);
  assert.equal(command('git', ['-C', 'upstream/fast-json-stable-stringify', 'rev-parse', 'HEAD']), '49e230da2c84247b29ad4de02c9395793caefd15');
  const selected = method.startsWith('select');
  const value = JSON.parse(fixture.input);
  const expected = selected ? JSON.stringify(lookup(value, fixture.pointer)) : oracle(value);
  assert.equal(typeof expected, 'string', 'Selected scalar must exist');
  const selectDirect = directSelector(id); // Selected once, not decoded/dispatched inside direct baseline timing.
  assert.equal(JSON.stringify(selectDirect(value)), JSON.stringify(lookup(value, fixture.pointer)));
  const fn = method === 'sort-native' ? () => installed.api.stringifyJson(fixture.input)
    : method === 'sort-js' ? () => oracle(JSON.parse(fixture.input))
    : method === 'select-native' ? () => installed.api.selectJson(fixture.input, fixture.pointer)
    : method === 'select-direct-js' ? () => JSON.stringify(selectDirect(JSON.parse(fixture.input)))
    : () => JSON.stringify(lookup(JSON.parse(fixture.input), fixture.pointer));
  const before = fn();
  assert.equal(before, expected, `${id}/${method}: complete exact pre-timing comparison`);
  const native = nativeArtifacts();
  assert.equal(native.length, method.endsWith('native') ? 1 : 0);
  if (native.length) {
    assert.equal(native[0].sha256, installed.metadata.packedInstalledFiles[`native/${path.basename(native[0].path)}`].sha256);
    if (process.platform === 'win32' && process.arch === 'x64') {
      assert.equal(native[0].sha256, hash(fs.readFileSync(path.join(root, 'target/x86_64-pc-windows-msvc/release/stable_json_rs.dll'))), 'Actual loaded addon equals release DLL');
    }
  }
  return { fn, expected, metadata: { ...installed.metadata, id, method, source: fixture.source, transform: fixture.transform, pointer: selected ? fixture.pointer : undefined,
    inputBytes: Buffer.byteLength(fixture.input), inputSha256: hash(fixture.input), outputBytes: Buffer.byteLength(expected), expectedSha256: hash(expected), beforeSha256: hash(before), beforeExact: true,
    oracle: { commit: '49e230da2c84247b29ad4de02c9395793caefd15', sourceSha256: hash(fs.readFileSync(oraclePath)) }, native, sources: all.sources,
    operation: selected ? `Existing JSON text to exact raw selected scalar text; whole-input validation. ${method === 'select-direct-js' ? 'Baseline JSON.parse + literal property accesses in a preselected function + JSON.stringify; no path decoding inside timing.' : 'Generic baseline JSON.parse + runtime pointer decoding/lookup + JSON.stringify; native public path decoding included.'}` : 'Existing JSON text to UTF16-key-sorted JSON text. Baseline JSON.parse + pinned upstream; exact equality independently checked for this fixture, not promised for arbitrary lexical JSON.' } };
}
function worker(id, method, candidate, checkOnly) {
  const ready = prepare(id, method, candidate);
  if (checkOnly) {
    const after = ready.fn(); assert.equal(after, ready.expected, 'Complete exact post-check comparison');
    return { ...ready.metadata, timed: false, afterSha256: hash(after), afterExact: true };
  }
  const warmupMs = Number(process.env.NATIVE_TEXT_WARMUP_MS || 1000);
  const sampleMs = Number(process.env.NATIVE_TEXT_SAMPLE_MS || 100);
  const count = Number(process.env.NATIVE_TEXT_SAMPLES || 9);
  assert.ok(warmupMs >= 1000 && sampleMs >= 100 && Number.isInteger(count) && count >= 9 && count % 2, 'At least1s warmup, odd >=9 samples >=100ms');
  let sink = 0;
  const interval = duration => {
    const start = performance.now(); let operations = 0;
    do {
      const output = ready.fn(); sink = (sink + output.length + output.charCodeAt(output.length >>> 1)) >>> 0; operations++;
    } while (performance.now() - start < duration);
    const elapsedMs = performance.now() - start;
    return { operations, elapsedMs, opsPerSecond: operations * 1000 / elapsedMs };
  };
  const memoryBeforeWarmup = process.memoryUsage(); interval(warmupMs);
  const memoryBeforeSamples = process.memoryUsage(); const cpuBefore = process.cpuUsage();
  const samples = Array.from({ length: count }, () => interval(sampleMs));
  const cpu = process.cpuUsage(cpuBefore); const memoryAfterSamples = process.memoryUsage(); const resources = process.resourceUsage();
  const after = ready.fn(); assert.equal(after, ready.expected, 'Complete exact post-timing comparison');
  const rates = samples.map(sample => sample.opsPerSecond); const rate = median(rates); const mad = median(rates.map(value => Math.abs(value - rate)));
  return { ...ready.metadata, timed: true, afterSha256: hash(after), afterExact: true, configuration: { warmupMs, sampleMs, count, outputConsumption: 'Returned primitive string length and middle UTF16 code unit; no timed hashing/logging/fixtures/module IO' }, samples,
    medianOpsPerSecond: rate, madPercent: mad / rate * 100, medianMicrosecondsPerOperation: 1e6 / rate, inputMiBPerSecond: rate * ready.metadata.inputBytes / 1048576, outputMiBPerSecond: rate * ready.metadata.outputBytes / 1048576,
    sink, cpuMicroseconds: cpu, memoryBeforeWarmup, memoryBeforeSamples, memoryAfterSamples, resourceUsage: resources,
    memoryCaveat: 'RSS snapshots and process maxRSS include modules, archive validation, fixture setup and warmup. Not per-operation allocation counts, serializer-only peaks, or evidence of lower memory use.' };
}
function lexicalControls(api) {
  const oracle = require(path.join(root, 'upstream/fast-json-stable-stringify'));
  const reports = [];
  for (const input of ['{"n":1.00,"z":-0,"s":"\\u0061"}', '{"n":9007199254740993}', '{"z":"\\ud800"}']) {
    const native = api.stringifyJson(input); const normalized = oracle(JSON.parse(input));
    reports.push({ input, native, normalized, equal: native === normalized, timed: false });
  }
  assert.equal(reports[0].equal, false); assert.equal(reports[1].equal, false);
  for (const input of ['{"a":1,"a":2}', '{"\\ud800":1}', '{"a":1,}']) {
    assert.throws(() => api.stringifyJson(input)); reports.push({ input, nativeRejected: true, timed: false });
  }
  const input = '{"n":1.00,"nested": { "x": 1 }}';
  assert.equal(api.selectJson(input, '/n'), '1.00');
  assert.notEqual(api.selectJson(input, '/nested'), JSON.stringify(JSON.parse(input).nested));
  reports.push({ input, selection: { scalar: api.selectJson(input, '/n'), subtree: api.selectJson(input, '/nested'), missing: api.selectJson(input, '/missing') ?? 'undefined' }, timed: false });
  return reports;
}
function main() {
  const candidate = process.env.NATIVE_TEXT_CANDIDATE;
  assert.ok(candidate, 'Set NATIVE_TEXT_CANDIDATE explicitly to an actual installed schema2 candidate');
  const checkOnly = process.env.NATIVE_TEXT_CHECK_ONLY === '1';
  if (process.argv[2] === '--worker') { process.stdout.write(JSON.stringify(worker(process.argv[3], process.argv[4], candidate, checkOnly))); return; }
  const all = fixtures(); const selected = process.env.NATIVE_TEXT_DATASETS?.split(',') || Object.keys(all.cases);
  const selectedMethods = process.env.NATIVE_TEXT_METHODS?.split(',') || primaryMethods;
  const repetitions = Number(process.env.NATIVE_TEXT_RUNS || 3);
  assert.ok(checkOnly || Number.isInteger(repetitions) && repetitions >= 2, 'At least two fresh-process runs');
  for (const id of selected) assert.ok(all.cases[id]); for (const method of selectedMethods) assert.ok(methods.includes(method));
  const startedAt = new Date().toISOString();
  const runnerBytes = fs.readFileSync(__filename); const runnerHash = hash(runnerBytes);
  const snapshot = path.join(__dirname, `run-${runnerHash.slice(0, 12)}.cjs`);
  if (fs.existsSync(snapshot)) assert.equal(hash(fs.readFileSync(snapshot)), runnerHash); else fs.writeFileSync(snapshot, runnerBytes, { flag: 'wx' });
  const installed = packed(candidate); const controls = lexicalControls(installed.api);
  const oracle = require(path.join(root, 'upstream/fast-json-stable-stringify'));
  const corpus = Object.fromEntries(selected.map(id => { const item = all.cases[id]; const object = JSON.parse(item.input); return [id, { input: item.input, sortedExpected: oracle(object), selectionPath: item.pointer, selectedExpected: JSON.stringify(lookup(object, item.pointer)) }]; }));
  const resultsDirectory = path.join(__dirname, 'results'); fs.mkdirSync(resultsDirectory, { recursive: true });
  const stem = `${startedAt.replace(/[:.]/g, '-')}-${process.pid}${checkOnly ? '-checks' : ''}`;
  const correctnessFile = path.join(resultsDirectory, `${stem}-corpus.json.gz`);
  fs.writeFileSync(correctnessFile, zlib.gzipSync(Buffer.from(JSON.stringify(corpus))), { flag: 'wx' });
  const report = { schemaVersion: 1, startedAt, runner: path.relative(root, snapshot), runnerSha256: runnerHash, correctnessCorpus: { file: path.relative(root, correctnessFile), sha256: hash(fs.readFileSync(correctnessFile)), meaning: 'Exact full original/transformed input, expected sorted output and expected selected scalar; gzip-compressed UTF8 JSON. Every measured before/after output compared completely, hashes recorded.' },
    invocation: { argv: process.argv, env: Object.fromEntries(Object.entries(process.env).filter(([key]) => key.startsWith('NATIVE_TEXT_'))) }, configuration: { selected, methods: selectedMethods, repetitions, serialFreshProcesses: true },
    environment: { node: process.version, v8: process.versions.v8, executable: process.execPath, nodeOptions: process.env.NODE_OPTIONS || null, execArgv: process.execArgv, os: os.version(), release: os.release(), platform: process.platform, arch: process.arch, cpu: os.cpus()[0], logicalCpus: os.cpus().length, totalMemory: os.totalmem(), rust: command('rustc', ['--version']), cargo: command('cargo', ['--version']), pnpm: process.platform === 'win32' ? command('cmd.exe', ['/d', '/s', '/c', 'pnpm --version']) : command('pnpm', ['--version']), git: command('git', ['--version']), gitCommit: command('git', ['rev-parse', 'HEAD']), gitStatus: command('git', ['status', '--short']) },
    controls, sources: all.sources, candidate: installed.metadata, results: [] };
  const reportFile = path.join(resultsDirectory, `${stem}.json`);
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2), { flag: 'wx' });
  for (let run = 1; run <= repetitions; run++) {
    const cells = shuffle(selected.flatMap(id => selectedMethods.map(method => ({ id, method }))), 70831 + run);
    for (const cell of cells) {
      const child = spawnSync(process.execPath, [snapshot, '--worker', cell.id, cell.method], { cwd: root, encoding: 'utf8', env: process.env, maxBuffer: 8 * 1024 * 1024 });
      if (child.status !== 0) { report.failure = { run, ...cell, status: child.status, stderr: child.stderr }; fs.writeFileSync(reportFile, JSON.stringify(report, null, 2)); throw new Error(JSON.stringify(report.failure)); }
      const result = JSON.parse(child.stdout); report.results.push({ run, ...result });
      fs.writeFileSync(reportFile, JSON.stringify(report, null, 2)); // Save completed cells even if later interrupted.
      process.stderr.write(`${run} ${cell.id}/${cell.method}: ${result.medianOpsPerSecond?.toFixed(1) || 'exact checked'}\n`);
    }
  }
  report.finishedAt = new Date().toISOString(); fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log(path.relative(root, reportFile));
}
if (require.main === module) { try { main(); } catch (error) { console.error(error); process.exitCode = 1; } }
module.exports = { methods, definitions, fixtures, packed, prepare, lexicalControls, median, shuffle, lookup, directSelector, hash };
