'use strict';
// End-to-end benchmark of the public API against the JavaScript pipelines people use
// today and, when present, the previous native build (target/baseline/old.node).
// Every cell checks its output before timing. Raw samples go to benches/results/.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const json = require('..');

const WARMUP_MS = Number(process.env.WARMUP_MS ?? 500);
const SAMPLE_MS = Number(process.env.SAMPLE_MS ?? 100);
const SAMPLES = Number(process.env.SAMPLES ?? 9);
const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null;

const root = path.join(__dirname, '..');
const optional = (file) => (fs.existsSync(file) ? require(file) : null);
const upstream = optional(path.join(root, 'upstream/fast-json-stable-stringify/index.js'));
const safeStable = require('safe-stable-stringify');
const old = optional(path.join(root, 'target/baseline/old.node'));

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function synthetic() {
  const next = rng(1);
  const words = ['alpha', 'beta', 'gamma', 'δέλτα', '東京', 'café', 'naïve', 'zeta', 'omega', 'kappa'];
  const records = Array.from({ length: 40000 }, (_, i) => ({
    zid: i, name: words[i % 10] + ' ' + words[(i * 7) % 10], score: Math.round(next() * 1e6) / 1e3,
    tags: [words[i % 3], words[i % 5]], active: i % 3 === 0, meta: { y: next() < 0.5 ? null : i * 31, x: 'v' + i, created: 1.7e12 + i },
  }));
  const floats = Array.from({ length: 200000 }, () => (next() - 0.5) * 10 ** Math.floor(next() * 12 - 4));
  const sortedRecords = JSON.parse(json.sortKeys(JSON.stringify(records)));
  return {
    'synthetic-records-8mb': JSON.stringify(records, null, 1),
    'synthetic-already-sorted': JSON.stringify(sortedRecords),
    'synthetic-floats': JSON.stringify(floats),
  };
}

function fixtures() {
  const data = path.join(__dirname, 'data');
  const manifest = JSON.parse(fs.readFileSync(path.join(data, 'manifest.json'), 'utf8'));
  const files = Object.fromEntries(manifest.map((m) => [m.file.replace(/\.json$/, ''), fs.readFileSync(path.join(data, m.file), 'utf8')]));
  return { ...files, ...synthetic() };
}

function pointerFor(text) {
  // A path to a scalar roughly in the middle of the document.
  let value = JSON.parse(text);
  const segments = [];
  while (value !== null && typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) break;
    const key = keys[Math.floor(keys.length / 2)];
    segments.push(key);
    value = value[key];
  }
  return { segments, pointer: segments.map((s) => '/' + s.replaceAll('~', '~0').replaceAll('/', '~1')).join('') };
}

function cells(name, text) {
  const bytes = Buffer.from(text);
  const canonical = json.canonicalizeValue(JSON.parse(text));
  const sorted = json.sortKeys(text);
  const minified = JSON.stringify(JSON.parse(text));
  const { segments, pointer } = pointerFor(text);
  const walk = (v) => { for (const s of segments) v = v[s]; return v; };
  const selected = JSON.stringify(walk(JSON.parse(text)));
  const list = [
    ['canonicalize', 'native string', () => json.canonicalize(text), canonical],
    ['canonicalize', 'native buffer->buffer', () => json.canonicalize(bytes, { output: 'buffer' }), canonical],
    ['canonicalize', 'JS JSON.parse+canonicalizeValue', () => json.canonicalizeValue(JSON.parse(text)), canonical],
    ['sortKeys', 'native string', () => json.sortKeys(text), sorted],
    ['sortKeys', 'JS JSON.parse+safe-stable-stringify', () => safeStable(JSON.parse(text)), null],
    ['minify', 'native string', () => json.minify(text), null],
    ['minify', 'JS JSON.stringify(JSON.parse)', () => JSON.stringify(JSON.parse(text)), minified],
    ['validate', 'native', () => json.validate(text), undefined],
    ['validate', 'JS JSON.parse', () => { JSON.parse(text); }, undefined],
    ['select', 'native', () => json.select(text, pointer), null],
    ['select', 'JS JSON.parse+walk+stringify', () => JSON.stringify(walk(JSON.parse(text))), selected],
  ];
  if (upstream) list.push(['sortKeys', 'JS JSON.parse+fast-json-stable-stringify', () => upstream(JSON.parse(text)), null]);
  if (old) {
    list.push(['sortKeys', 'previous native stringifyJson', () => old.stringifyJson(text), null]);
    list.push(['select', 'previous native selectJson', () => old.selectJson(text, segments), null]);
  }
  return list.map(([op, impl, run, expected]) => {
    const output = run();
    let equivalent;
    if (expected !== null) equivalent = String(output) === String(expected);
    else if (op === 'select') equivalent = JSON.stringify(JSON.parse(output)) === selected;
    else equivalent = JSON.stringify(JSON.parse(output)) === minified || json.canonicalize(output) === canonical;
    return { fixture: name, bytes: bytes.length, op, impl, run, equivalent, exact: expected !== null && equivalent };
  });
}

function measure(run) {
  const until = (ms, fn) => { const end = performance.now() + ms; let n = 0; while (performance.now() < end) { fn(); n++; } return n; };
  until(WARMUP_MS, run);
  const samples = [];
  for (let s = 0; s < SAMPLES; s++) {
    const start = performance.now();
    let n = 0;
    do { run(); n++; } while (performance.now() - start < SAMPLE_MS);
    samples.push(n / ((performance.now() - start) / 1000));
  }
  const sorted = samples.slice().sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const mad = sorted.map((v) => Math.abs(v - median)).sort((a, b) => a - b)[Math.floor(sorted.length / 2)];
  return { samples, median, madPct: (100 * mad) / median };
}

function main() {
  const all = Object.entries(fixtures()).flatMap(([name, text]) => cells(name, text)).filter((c) => !only || only.test(`${c.fixture} ${c.op} ${c.impl}`));
  const next = rng(Date.now() | 0);
  for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
  const results = [];
  for (const cell of all) {
    const { run, ...meta } = cell;
    results.push({ ...meta, ...measure(run) });
    process.stderr.write('.');
  }
  process.stderr.write('\n');
  results.sort((a, b) => a.fixture.localeCompare(b.fixture) || a.op.localeCompare(b.op) || b.median - a.median);
  const environment = { node: process.version, v8: process.versions.v8, platform: `${process.platform}-${process.arch}`, cpu: os.cpus()[0]?.model, date: new Date().toISOString(), WARMUP_MS, SAMPLE_MS, SAMPLES };
  const dir = path.join(__dirname, 'results');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${environment.date.replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, JSON.stringify({ environment, results }, null, 1));
  console.log(`| fixture | op | implementation | ops/s | MiB/s | vs best JS | MAD % | output |`);
  console.log('|---|---|---|---:|---:|---:|---:|---|');
  for (const r of results) {
    const js = results.filter((o) => o.fixture === r.fixture && o.op === r.op && o.impl.startsWith('JS')).reduce((m, o) => Math.max(m, o.median), 0);
    const ratio = js ? `${(r.median / js).toFixed(2)}x` : '';
    const mib = ((r.median * r.bytes) / 2 ** 20).toFixed(0);
    console.log(`| ${r.fixture} | ${r.op} | ${r.impl} | ${r.median.toFixed(0)} | ${mib} | ${ratio} | ${r.madPct.toFixed(1)} | ${r.exact ? 'exact' : r.equivalent ? 'same value' : 'DIFFERENT'} |`);
  }
  console.log(`\n${JSON.stringify(environment)}\nraw: ${path.relative(root, file)}`);
}

main();
