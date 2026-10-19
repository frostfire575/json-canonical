'use strict';
// Verify the same downloaded tarball on every CI target. This script never
// builds or repacks, and package installation runs separately with scripts off.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const [mode, suppliedDirectory] = process.argv.slice(2);
assert.ok(['manifest', 'prepare', 'verify'].includes(mode) && suppliedDirectory,
  'Usage: node scripts/verify-ci-candidate.cjs manifest|prepare|verify DIRECTORY [--all-targets]');
const directory = path.resolve(suppliedDirectory);
const binaryFiles = {
  'win32/x64': 'stable-json-rs.win32-x64-msvc.node',
  'linux/x64': 'stable-json-rs.linux-x64-gnu.node',
  'darwin/arm64': 'stable-json-rs.darwin-arm64.node',
};
const host = `${process.platform}/${process.arch}`;
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const manifestPath = path.join(directory, 'candidate.json');
if (mode === 'manifest') {
  const tarballs = fs.readdirSync(directory).filter(file => file.endsWith('.tgz'));
  assert.equal(tarballs.length, 1, 'exactly one final candidate must be packed');
  const filename = tarballs[0];
  const manifest = { filename, sha256: sha256(path.join(directory, filename)),
    gitCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify(manifest));
  process.exit(0);
}
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
assert.equal(path.basename(manifest.filename), manifest.filename, 'candidate filename must be local');
const candidate = path.join(directory, manifest.filename);
assert.equal(sha256(candidate), manifest.sha256, 'downloaded final candidate SHA-256');
if (mode === 'prepare') {
  for (const manager of ['npm', 'pnpm']) {
    const consumer = path.join(directory, manager);
    fs.mkdirSync(consumer, { recursive: true });
    assert.ok(!fs.existsSync(path.join(consumer, 'node_modules')), 'consumer must be fresh');
    fs.copyFileSync(candidate, path.join(consumer, 'candidate.tgz'));
    fs.writeFileSync(path.join(consumer, 'package.json'), JSON.stringify({
      name: `candidate-${manager}-consumer`, private: true, version: '0.0.0',
    }));
  }
  console.log(`Prepared fresh consumers of SHA-256 ${manifest.sha256}`);
  process.exit(0);
}
assert.ok(binaryFiles[host], `supported verification host: ${host}`);
const compilerManifest = require.resolve('typescript/package.json');
const compilerPackage = JSON.parse(fs.readFileSync(compilerManifest, 'utf8'));
const compiler = path.resolve(path.dirname(compilerManifest), compilerPackage.bin.tsc);
for (const manager of ['npm', 'pnpm']) {
  const consumer = path.join(directory, manager);
  const reportPath = path.join(directory, `verification-${manager}-${process.version}-${Date.now()}-${process.pid}.json`);
  const report = { ...manifest, manager, host, node: process.version, date: new Date().toISOString(),
    allTargetsRequired: process.argv.includes('--all-targets'), status: 'FAIL' };
  try {
    assert.equal(sha256(path.join(consumer, 'candidate.tgz')), manifest.sha256, 'installed tarball identity');
    const installed = path.join(consumer, 'node_modules', 'stable-json-rs');
    const targets = report.allTargetsRequired ? Object.values(binaryFiles) : [binaryFiles[host]];
    for (const filename of targets) {
      assert.ok(fs.statSync(path.join(installed, 'native', filename)).size > 0, `bundled ${filename}`);
    }
    fs.writeFileSync(path.join(consumer, 'verify.cjs'), String.raw`
const assert = require('node:assert/strict');
const api = require('stable-json-rs');
const value = {z:[null, '東京', {b:2,a:1}], a:-0};
assert.equal(api.stringify(value), '{"a":0,"z":[null,"東京",{"a":1,"b":2}]}');
assert.equal(api.stableStringify(value), api.stringify(value));
assert.deepEqual(api.stringifyBatch([value, undefined]), [api.stringify(value), undefined]);
assert.equal(api.stringifyJson('{"z":2,"a":1}'), '{"a":1,"z":2}');
assert.deepEqual(api.stringifyJsonBatch(['{"b":2,"a":1}', '[1,2]']), ['{"a":1,"b":2}', '[1,2]']);
assert.equal(api.selectJson('{"a":[1,{"東京":2}]}', '/a/1/東京'), '2');
assert.throws(() => api.stringifyJson('{'), /./);
// Exercise the large dense-Unicode native output route from the installed
// binary, including Latin1 characters and astral UTF-16 surrogate pairs.
const denseSamples = ['東京বাংলা😀'.repeat(256), 'éöÿ'.repeat(512)];
const codeUnits = text => Array.from({length:text.length}, (_, index) => text.charCodeAt(index));
for (const sample of denseSamples) {
  const input = JSON.stringify({z:sample, a:sample});
  const expected = JSON.stringify({a:sample, z:sample});
  assert.ok(Buffer.byteLength(expected, 'utf8') > 1024);
  const actual = api.stringifyJson(input);
  assert.equal(actual, expected);
  assert.deepEqual(codeUnits(actual), codeUnits(expected));
  assert.deepEqual(api.stringifyJsonBatch([input, input]), [expected, expected]);
  assert.equal(api.selectJson(input, '/z'), JSON.stringify(sample));
}
// JSON text retains lexical spelling. Dense output must not decode or replace
// escaped lone surrogates, escaped ASCII, negative zero or decimal tokens.
const suffix = JSON.stringify(denseSamples[0]);
const lexical = '{"z":1.00,"a":"\\ud800x\\udfff","b":"\\u0061","c":-0,"d":' + suffix + '}';
const lexicalExpected = '{"a":"\\ud800x\\udfff","b":"\\u0061","c":-0,"d":' + suffix + ',"z":1.00}';
assert.equal(api.stringifyJson(lexical), lexicalExpected);
assert.deepEqual(api.stringifyJsonBatch([lexical]), [lexicalExpected]);
assert.equal(api.selectJson(lexical, '/a'), '"\\ud800x\\udfff"');
assert.throws(() => api.stringifyJsonBatch([JSON.stringify({a:denseSamples[0]}), '{']), /Batch item 1/);
const cache = api.createSerializerCache();
const object = {a:1};
assert.equal(cache.stringify(object, 1), '{"a":1}');
object.a = 2;
assert.equal(cache.stringify(object, 2), '{"a":2}');
assert.ok(require('node:fs').statSync(require('node:path').join(require('node:path').dirname(require.resolve('stable-json-rs')), '../THIRD_PARTY_NOTICES.txt')).size > 0);
console.log('Installed CJS and native APIs PASS');
`);
    fs.writeFileSync(path.join(consumer, 'verify.mjs'), `
import assert from 'node:assert/strict';
import stringify, {stringifyJson, stringifyJsonBatch, selectJson} from 'stable-json-rs';
assert.equal(stringify({z:1,a:2}), '{"a":2,"z":1}');
assert.equal(stringifyJson('{"z":1,"a":2}'), '{"a":2,"z":1}');
assert.deepEqual(stringifyJsonBatch(['{}']), ['{}']);
assert.equal(selectJson('{"a":1}', '/a'), '1');
const dense = 'é東京😀'.repeat(300);
const denseInput = JSON.stringify({z:dense, a:dense});
const denseExpected = JSON.stringify({a:dense, z:dense});
assert.equal(stringifyJson(denseInput), denseExpected);
assert.deepEqual(stringifyJsonBatch([denseInput]), [denseExpected]);
assert.equal(selectJson(denseInput, '/z'), JSON.stringify(dense));
console.log('Installed ESM and native APIs PASS');
`);
    for (const filename of ['verify.cjs', 'verify.mjs']) {
      process.stdout.write(execFileSync(process.execPath, [filename], { cwd: consumer, encoding: 'utf8' }));
    }
    fs.writeFileSync(path.join(consumer, 'types.cts'), `
import api = require('stable-json-rs');
const text: string | undefined = api.stringify({a: 1});
const selected: string | undefined = api.selectJson('{"a":1}', '/a');
const batch: string[] = api.stringifyJsonBatch(['{}']);
api.createSerializerCache().stringify({}, 1);
void [text, selected, batch];
`);
    fs.writeFileSync(path.join(consumer, 'types.mts'), `
import stringify, {selectJson, stringifyJsonBatch} from 'stable-json-rs';
const text: string | undefined = stringify({a: 1});
const selected: string | undefined = selectJson('{"a":1}', '/a');
const batch: string[] = stringifyJsonBatch(['{}']);
void [text, selected, batch];
`);
    fs.writeFileSync(path.join(consumer, 'tsconfig.json'), JSON.stringify({ compilerOptions: {
      target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true,
      noEmit: true, skipLibCheck: true,
    }, include: ['types.cts', 'types.mts'] }));
    execFileSync(process.execPath, [compiler, '-p', consumer], { cwd: consumer, stdio: 'inherit' });
    report.status = 'PASS';
    console.log(`Installed ${manager} CJS/ESM/types/native PASS (${host}, ${process.version})`);
  } catch (error) {
    report.error = String(error.stack || error);
    throw error;
  } finally {
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  }
}
