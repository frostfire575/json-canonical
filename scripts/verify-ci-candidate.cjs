'use strict';
// Verify the same downloaded tarball on every CI target. This script never
// builds or repacks, and package installation runs separately with scripts off.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const binaryFiles = {
  'win32/x64': 'stable-json-rs.win32-x64-msvc.node',
  'linux/x64': 'stable-json-rs.linux-x64-gnu.node',
  'darwin/arm64': 'stable-json-rs.darwin-arm64.node',
};
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const runtimeFiles = ['package.json', 'js/dist/index.js', 'js/dist/index.d.ts',
  'js/index.cjs', 'js/index.mjs', 'js/index.d.mts', 'native/binding.js',
  'native/binding.d.ts', 'LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES.txt',
  'README.md', 'docs/performance.md'];
function localFilename(filename) {
  assert.equal(typeof filename, 'string', 'candidate filename must be a string');
  assert.match(filename, /^[A-Za-z0-9][A-Za-z0-9._-]*\.tgz$/, 'candidate filename must be local');
  return filename;
}
function archivePaths(candidate) {
  const listing = execFileSync('tar', ['-tzf', candidate], {encoding: 'utf8', maxBuffer: 16 * 1024 * 1024});
  return validateArchivePaths(listing);
}
function validateArchivePaths(listing) {
  const files = listing.split(/\r?\n/).filter(Boolean);
  const seen = new Set();
  for (const file of files) {
    assert.ok(file.startsWith('package/') && !file.includes('\\') &&
      !file.split('/').some(part => part === '.' || part === '..') &&
      !file.includes('//') && !/[\x00-\x1f\x7f:]/.test(file), 'safe package archive path');
    assert.ok(!seen.has(file), `duplicate archive entry: ${file}`);
    seen.add(file);
  }
  return seen;
}
// Header inspection is a packaging check, not proof that a foreign addon loads.
function binaryArchitecture(bytes, filename) {
  assert.ok(bytes.length >= 64, `native header: ${filename}`);
  if (filename === binaryFiles['win32/x64']) {
    assert.equal(bytes.toString('ascii', 0, 2), 'MZ', 'Windows PE header');
    const offset = bytes.readUInt32LE(0x3c);
    assert.ok(offset <= bytes.length - 6, 'bounded PE header');
    assert.equal(bytes.toString('binary', offset, offset + 4), 'PE\0\0', 'Windows PE signature');
    assert.equal(bytes.readUInt16LE(offset + 4), 0x8664, 'Windows x64 machine');
  } else if (filename === binaryFiles['linux/x64']) {
    assert.equal(bytes.toString('binary', 0, 4), '\x7fELF', 'Linux ELF header');
    assert.equal(bytes[4], 2, 'ELF64');
    assert.equal(bytes[5], 1, 'little-endian ELF');
    assert.equal(bytes.readUInt16LE(18), 62, 'Linux x86_64 machine');
  } else if (filename === binaryFiles['darwin/arm64']) {
    assert.equal(bytes.readUInt32LE(0), 0xfeedfacf, '64-bit Mach-O header');
    assert.equal(bytes.readUInt32LE(4), 0x0100000c, 'macOS ARM64 machine');
  } else assert.fail(`unexpected native binary: ${filename}`);
}
function packedFiles(candidate, requireAll) {
  const inventory = archivePaths(candidate);
  const natives = [...inventory].filter(file => file.endsWith('.node'));
  assert.ok(natives.length > 0, 'at least one actual native artifact required');
  for (const file of natives) assert.ok(Object.values(binaryFiles).some(name => file === `package/native/${name}`), `supported native artifact: ${file}`);
  if (requireAll) for (const file of Object.values(binaryFiles)) assert.ok(inventory.has(`package/native/${file}`), `combined candidate missing ${file}`);
  const files = {};
  for (const file of [...runtimeFiles, ...natives.map(file => file.slice('package/'.length))]) {
    assert.ok(inventory.has(`package/${file}`), `packed runtime file: ${file}`);
    const bytes = execFileSync('tar', ['-xzOf', candidate, `package/${file}`], {maxBuffer: 128 * 1024 * 1024});
    assert.ok(bytes.length > 0, `nonempty runtime file: ${file}`);
    if (file.endsWith('.node')) binaryArchitecture(bytes, path.basename(file));
    files[file] = {bytes: bytes.length, sha256: digest(bytes)};
  }
  return files;
}
function validateManifest(manifest) {
  localFilename(manifest.filename);
  assert.equal(manifest.schemaVersion, 2, 'candidate manifest schema 2 required; create a new manifest for this candidate');
  assert.match(manifest.sha256, /^[0-9a-f]{64}$/, 'SHA-256 identity');
  assert.match(manifest.gitCommit, /^[0-9a-f]{40}$/, 'Git identity');
  assert.ok(manifest.files && typeof manifest.files === 'object', 'packed file identities');
  for (const file of runtimeFiles) assert.ok(Object.hasOwn(manifest.files, file), `runtime identity: ${file}`);
  for (const [file, identity] of Object.entries(manifest.files)) {
    assert.ok(runtimeFiles.includes(file) || Object.values(binaryFiles).some(name => file === `native/${name}`), 'supported manifest file');
    assert.ok(Number.isSafeInteger(identity.bytes) && identity.bytes > 0, 'positive packed size');
    assert.match(identity.sha256, /^[0-9a-f]{64}$/, 'packed file digest');
  }
}
function main(args = process.argv.slice(2)) {
const [mode, suppliedDirectory] = args;
assert.ok(['manifest', 'prepare', 'verify'].includes(mode) && suppliedDirectory && args.slice(2).every(arg => arg === '--all-targets'),
  'Usage: node scripts/verify-ci-candidate.cjs manifest|prepare|verify DIRECTORY [--all-targets]');
const directory = path.resolve(suppliedDirectory);
const host = `${process.platform}/${process.arch}`;
const manifestPath = path.join(directory, 'candidate.json');
if (mode === 'manifest') {
  const tarballs = fs.readdirSync(directory).filter(file => file.endsWith('.tgz'));
  assert.equal(tarballs.length, 1, 'exactly one final candidate must be packed');
  const filename = localFilename(tarballs[0]);
  const manifest = { schemaVersion: 2, filename, sha256: sha256(path.join(directory, filename)),
    files: packedFiles(path.join(directory, filename), args.includes('--all-targets')),
    gitCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', {flag: 'wx'});
  console.log(JSON.stringify(manifest));
  process.exit(0);
}
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
validateManifest(manifest);
const candidate = path.join(directory, manifest.filename);
assert.equal(sha256(candidate), manifest.sha256, 'downloaded final candidate SHA-256');
assert.deepEqual(packedFiles(candidate, args.includes('--all-targets')), manifest.files, 'manifest describes actual packed runtime bytes');
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
    command: [process.execPath, __filename, ...args], nodeVersions: process.versions,
    typeScript: compilerPackage.version,
    allTargetsRequired: args.includes('--all-targets'), verifierSha256: sha256(__filename), status: 'FAIL' };
  try {
    assert.equal(sha256(path.join(consumer, 'candidate.tgz')), manifest.sha256, 'installed tarball identity');
    const installed = path.join(consumer, 'node_modules', 'stable-json-rs');
    for (const [file, identity] of Object.entries(manifest.files)) {
      assert.equal(fs.statSync(path.join(installed, file)).size, identity.bytes, `installed size: ${file}`);
      assert.equal(sha256(path.join(installed, file)), identity.sha256, `installed packed-file identity: ${file}`);
    }
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
// Native conversion must use exactly the indexed values validated by the wrapper.
// A custom iterator must not suppress malformed strings from batch validation.
const malformed = '"' + String.fromCharCode(0xd800) + '"';
const hiddenInvalid = [malformed];
hiddenInvalid[Symbol.iterator] = function* () {};
assert.throws(() => api.stringifyJsonBatch(hiddenInvalid), TypeError);
const stateful = ['{}'];
let indexedReads = 0;
Object.defineProperty(stateful, 0, {get() {
  indexedReads++;
  return indexedReads === 1 ? '{"z":2,"a":1}' : malformed;
}});
assert.deepEqual(api.stringifyJsonBatch(stateful), ['{"a":1,"z":2}']);
assert.equal(indexedReads, 1, 'batch indexed getter is read exactly once');
const mutatedByOptions = ['{"z":2,"a":1}'];
assert.deepEqual(api.stringifyJsonBatch(mutatedByOptions, {get maxDepth() {
  mutatedByOptions[0] = malformed;
  return 128;
}}), ['{"a":1,"z":2}']);
assert.equal(mutatedByOptions[0], malformed, 'option getter actually mutated original input');
let depthReads = 0;
assert.throws(() => api.stringifyJson('[[0]]', {get maxDepth() {
  return ++depthReads === 1 ? 1 : undefined;
}}), /nesting/i);
assert.equal(depthReads, 1, 'native receives the depth option that was validated');
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
const loaded = Object.keys(require.cache).filter(file => file.endsWith('.node'));
assert.equal(loaded.length, 1, 'exactly one actual addon loaded');
require('node:fs').writeFileSync(process.argv[2], JSON.stringify({
  path: require('node:fs').realpathSync(loaded[0]),
  sha256: require('node:crypto').createHash('sha256').update(require('node:fs').readFileSync(loaded[0])).digest('hex'),
}));
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
      process.stdout.write(execFileSync(process.execPath, [filename, path.join(consumer, 'loaded-native.json')], { cwd: consumer, encoding: 'utf8' }));
    }
    report.loadedNative = JSON.parse(fs.readFileSync(path.join(consumer, 'loaded-native.json'), 'utf8'));
    assert.equal(report.loadedNative.path, fs.realpathSync(path.join(installed, 'native', binaryFiles[host])), 'loaded installed local artifact');
    assert.equal(report.loadedNative.sha256, manifest.files[`native/${binaryFiles[host]}`].sha256, 'loaded addon matches packed bytes');
    fs.writeFileSync(path.join(consumer, 'types.cts'), `
import api = require('stable-json-rs');
const text: string | undefined = api.stringify({a: 1});
const selected: string | undefined = api.selectJson('{"a":1}', '/a');
const batch: string[] = api.stringifyJsonBatch(['{}']);
api.createSerializerCache().stringify({}, 1);
// @ts-expect-error text APIs do not accept arbitrary live objects
api.stringifyJson({a: 1});
// @ts-expect-error explicit cache versions are mandatory
api.createSerializerCache().stringify({});
void [text, selected, batch];
`);
    fs.writeFileSync(path.join(consumer, 'types.mts'), `
import stringify, {selectJson, stringifyJsonBatch} from 'stable-json-rs';
const text: string | undefined = stringify({a: 1});
const selected: string | undefined = selectJson('{"a":1}', '/a');
const batch: string[] = stringifyJsonBatch(['{}']);
// @ts-expect-error batch items must already be JSON text
stringifyJsonBatch([1]);
// @ts-expect-error paths are strings rather than arbitrary expressions
selectJson('{}', 1);
void [text, selected, batch];
`);
    fs.writeFileSync(path.join(consumer, 'tsconfig.json'), JSON.stringify({ compilerOptions: {
      target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true,
      noEmit: true, skipLibCheck: false,
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
}
if (require.main === module) main();
module.exports = { localFilename, validateArchivePaths, archivePaths, binaryArchitecture, packedFiles, validateManifest };
