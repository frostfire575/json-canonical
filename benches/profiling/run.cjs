'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const { datasets } = require('../datasets.cjs');
const api = require('../../js/index.cjs');
const oracle = require('../../upstream/fast-json-stable-stringify');
const { Probe } = require('./native/binding.js');
const repetitions = 9;
const sampleMs = Number(process.env.PROFILE_SAMPLE_MS || 100);
let sink = 0;
function consume(value) { sink = (sink + (typeof value === 'string' ? value.length + value.charCodeAt(value.length >>> 1) : value)) >>> 0; }
function burst(fn, milliseconds) {
  let count = 0;
  const start = performance.now();
  do { for (let i = 0; i < 16; i++) { consume(fn()); count++; } }
  while (performance.now() - start < milliseconds);
  return { count, elapsedMs: performance.now() - start };
}
const median = numbers => [...numbers].sort((a, b) => a - b)[numbers.length >>> 1];
function measure(name, fn, expected) {
  if (expected !== undefined) assert.equal(fn(), expected, name);
  burst(fn, 300);
  const samples = Array.from({ length: repetitions }, () => burst(fn, sampleMs));
  const durations = samples.map(s => s.elapsedMs * 1000 / s.count);
  const us = median(durations);
  return { name, medianUs: us, madPercent: 100 * median(durations.map(x => Math.abs(x - us))) / us, samples, sink };
}
function command(file, args) { return execFileSync(file, args, { cwd: root, encoding: 'utf8' }).trim(); }
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const report = { date: new Date().toISOString(), command: 'node benches/profiling/run.cjs',
  configuration: { datasets: process.env.PROFILE_DATASETS || null, methods: process.env.PROFILE_METHODS || null, sampleMs, repetitions },
  environment: { node: process.version, v8: process.versions.v8, rust: command('rustc', ['--version']),
    os: os.release(), cpu: os.cpus()[0].model, commit: command('git', ['rev-parse', 'HEAD']), dirty: command('git', ['status', '--short']) },
  hashes: Object.fromEntries(['src/lib.rs', 'src/engine.rs', 'src/tree.rs', 'js/dist/index.js', 'benches/profiling/src/lib.rs'].map(file => [file, hash(path.join(root, file))])),
  sources: Object.fromEntries(['benches/profiling/src/lib.rs', 'benches/profiling/run.cjs', 'benches/profiling/Cargo.toml', 'benches/profiling/Cargo.lock'].map(file => [file, fs.readFileSync(path.join(root, file), 'utf8')])),
  probeArtifacts: fs.readdirSync(path.join(__dirname, 'native')).filter(f => f.endsWith('.node')).map(file => ({ file, hash: hash(path.join(__dirname, 'native', file)) })),
  results: [], limitations: ['Probe class call overhead differs from production free functions.', 'OutputUTF16 clones a precomputed vector: includes Rust allocation/copy plus Node output creation.',
    'Isolated stage durations are not additive; use public-API validation before adopting any route.', 'Allocator counts and V8 internal callstack attribution NOT MEASURED.'] };
const extra = {
  latin1: { value: 'é'.repeat(16000) },
  'sparse-unicode': { value: 'x'.repeat(50000) + '😀' },
  'unicode-short': { value: 'বাংলা😀' },
  'ascii-string': { value: 'x'.repeat(50000) },
  'unicode-prefix-ascii-tail': { value: '😀'.repeat(256) + 'x'.repeat(50000) },
};
for (const dataset of (process.env.PROFILE_DATASETS || 'unicode,dependency-lock,tiny').split(',')) {
  const value = extra[dataset] ?? datasets()[dataset];
  const input = JSON.stringify(value);
  const expected = oracle(value);
  const probe = new Probe(input);
  const methods = {
    'routing-full-scan': [() => probe.routingFullScan(), Buffer.byteLength(expected) >= 1024 && [...Buffer.from(expected)].filter(byte=>byte>=128).length >= Buffer.byteLength(expected)/8],
    'routing-screened': [() => probe.routingScreened(), Buffer.byteLength(expected) >= 1024 && [...Buffer.from(expected).subarray(0,1024)].filter(byte=>byte>=128).length >= 128 && [...Buffer.from(expected)].filter(byte=>byte>=128).length >= Buffer.byteLength(expected)/8],
    'routing-sampled': [() => probe.routingSampled(), Buffer.byteLength(expected) >= 1024 && [0,1,2,3].every(index=>{const bytes=Buffer.from(expected);const start=Math.floor(index*(bytes.length-256)/3);return [...bytes.subarray(start,start+256)].filter(byte=>byte>=128).length>=32;})],
    boundary: [() => probe.boundary(), Buffer.byteLength(input)],
    'input-utf8-allocation-copy': [() => probe.acceptUtf8(input), Buffer.byteLength(input)],
    'input-utf16-allocation-copy': [() => probe.acceptUtf16(input), input.length],
    'roundtrip-utf8': [() => probe.roundtripUtf8(input), input],
    'roundtrip-utf16': [() => probe.roundtripUtf16(input), input],
    'output-utf8-borrowed': [() => probe.outputUtf8(), expected],
    'output-utf16-clone': [() => probe.outputUtf16(), expected],
    'stored-engine-no-transfer': [() => probe.storedEngine(), Buffer.byteLength(expected)],
    'input-and-engine-no-output': [() => probe.engineWithoutOutputConversion(input), Buffer.byteLength(expected)],
    'sort-utf16-output': [() => probe.sortUtf16Output(input), expected],
    'sort-adaptive-output': [() => probe.sortAdaptiveOutput(input), expected],
    'sort-utf16-input-output': [() => probe.sortUtf16InputOutput(input), expected],
    'input-utf16-standard-transcode': [() => probe.acceptUtf16Transcoded(input), Buffer.byteLength(input)],
    'output-utf16-standard-transcode': [() => probe.outputUtf16Transcoded(), expected],
    'sort-bulk-transcoded': [() => probe.sortBulkTranscoded(input), expected],
    'serde-validation-stored': [() => probe.validateStored(), Buffer.byteLength(input)],
    'scan-sort-drop-stored': [() => probe.scanSortStored(), Buffer.byteLength(input)],
    'public-native': [() => api.stringifyJson(input), expected],
    'js-parse-upstream': [() => oracle(JSON.parse(input)), expected],
  };
  for (const [name, [fn, expectedValue]] of Object.entries(methods)) {
    if (process.env.PROFILE_METHODS && !process.env.PROFILE_METHODS.split(',').includes(name)) continue;
    const result = { dataset, inputBytes: Buffer.byteLength(input), inputCodeUnits: input.length, ...measure(name, fn, expectedValue) };
    report.results.push(result);
    console.log(`${dataset} ${name}: ${result.medianUs.toFixed(3)} us MAD ${result.madPercent.toFixed(1)}%`);
  }
  // Emission's Rust-side clock excludes construction; timer/FFI are not part
  // of these values. This is a separately labeled stage observation.
  const emissionNs = Array.from({ length: 101 }, () => probe.emitStored());
  report.results.push({ dataset, name: 'emit-prebuilt-Rust-clock', medianUs: median(emissionNs) / 1000, emissionNs });
  const keySortNs = Array.from({ length: 101 }, () => probe.keySortClock());
  report.results.push({ dataset, name: 'key-sort-prebuilt-Rust-clock', medianUs: median(keySortNs) / 1000, keySortNs });
}
const output = path.join(__dirname, 'results', `${report.date.replace(/[:.]/g, '-')}-${process.pid}.json`);
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(report, null, 2), { flag: 'wx' });
console.log(`Raw profiling results: ${output}`);
