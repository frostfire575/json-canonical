'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const verifier = require('../scripts/verify-ci-candidate.cjs');
const root = path.resolve(__dirname, '..');

test('candidate filename rejects traversal and Windows path syntax', () => {
  assert.equal(verifier.localFilename('stable-json-rs-0.1.0.tgz'), 'stable-json-rs-0.1.0.tgz');
  for (const file of ['../x.tgz', 'x/y.tgz', 'x\\y.tgz', 'C:x.tgz', '/x.tgz', '-x.tgz', 'x.tgz\n', undefined]) {
    assert.throws(() => verifier.localFilename(file));
  }
});

test('archive inventory rejects traversal, ambiguous and duplicate entries', () => {
  assert.equal(verifier.validateArchivePaths('package/\npackage/js/index.cjs\n').size, 2);
  for (const listing of ['../x', 'package/../x', 'package/./x', 'package//x', 'package/C:x',
    'package\\x', '/package/x', 'package/x\npackage/x', 'package/x\tbad']) {
    assert.throws(() => verifier.validateArchivePaths(listing), listing);
  }
});

test('native header diagnostics reject wrong architectures and truncation', () => {
  // In-memory header test vectors only; these are never packed or loaded addons.
  const pe = Buffer.alloc(128);
  pe.write('MZ'); pe.writeUInt32LE(64, 60); pe.write('PE\0\0', 64); pe.writeUInt16LE(0x8664, 68);
  verifier.binaryArchitecture(pe, 'stable-json-rs.win32-x64-msvc.node');
  pe.writeUInt16LE(0xaa64, 68);
  assert.throws(() => verifier.binaryArchitecture(pe, 'stable-json-rs.win32-x64-msvc.node'), /x64/);
  pe.writeUInt32LE(0xffffffff, 60);
  assert.throws(() => verifier.binaryArchitecture(pe, 'stable-json-rs.win32-x64-msvc.node'), /bounded/);
  const elf = Buffer.alloc(64);
  elf.write('\x7fELF', 'binary'); elf[4] = 2; elf[5] = 1; elf.writeUInt16LE(62, 18);
  verifier.binaryArchitecture(elf, 'stable-json-rs.linux-x64-gnu.node');
  elf.writeUInt16LE(183, 18);
  assert.throws(() => verifier.binaryArchitecture(elf, 'stable-json-rs.linux-x64-gnu.node'), /x86_64/);
  const macho = Buffer.alloc(64);
  macho.writeUInt32LE(0xfeedfacf, 0); macho.writeUInt32LE(0x0100000c, 4);
  verifier.binaryArchitecture(macho, 'stable-json-rs.darwin-arm64.node');
  macho.writeUInt32LE(0x01000007, 4);
  assert.throws(() => verifier.binaryArchitecture(macho, 'stable-json-rs.darwin-arm64.node'), /ARM64/);
  assert.throws(() => verifier.binaryArchitecture(Buffer.alloc(8), 'x.node'), /header/);
});

test('packed identity matches actual host binary and fails combined gate without foreign files', () => {
  const binaries = {'win32/x64':'stable-json-rs.win32-x64-msvc.node',
    'linux/x64':'stable-json-rs.linux-x64-gnu.node', 'darwin/arm64':'stable-json-rs.darwin-arm64.node'};
  const binary = binaries[`${process.platform}/${process.arch}`];
  assert.ok(binary, 'test requires a supported build host');
  const directory = path.join(root, '.verification', `candidate-verifier-test-${process.pid}-${Date.now()}`);
  fs.mkdirSync(directory, {recursive:true});
  const source = path.join(directory, 'package');
  fs.mkdirSync(source);
  const files = ['package.json', 'js/dist/index.js', 'js/dist/index.d.ts', 'js/index.cjs',
    'js/index.mjs', 'js/index.d.mts', 'native/binding.js', 'native/binding.d.ts',
    'LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES.txt', 'README.md', 'docs/performance.md', `native/${binary}`];
  try {
    for (const file of files) {
      fs.mkdirSync(path.dirname(path.join(source,file)), {recursive:true});
      fs.copyFileSync(path.join(root,file), path.join(source,file));
    }
    const candidate = path.join(directory, 'candidate.tgz');
    execFileSync('tar', ['-czf', candidate, '-C', directory, 'package']);
    const identities = verifier.packedFiles(candidate, false);
    const expected = crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'native',binary))).digest('hex');
    assert.equal(identities[`native/${binary}`].sha256, expected);
    assert.throws(() => verifier.packedFiles(candidate, true), /combined candidate missing/);
    const manifest = {schemaVersion:2,filename:'candidate.tgz',sha256:'a'.repeat(64),gitCommit:'b'.repeat(40),files:identities};
    verifier.validateManifest(manifest);
    assert.throws(() => verifier.validateManifest({...manifest,schemaVersion:1}), /schema 2/);
    assert.throws(() => verifier.validateManifest({...manifest,sha256:'bad'}), /SHA-256/);
    assert.throws(() => verifier.validateManifest({...manifest,files:{...identities,'../bad':identities['package.json']}}), /supported manifest file/);
  } finally {
    assert.ok(directory.startsWith(path.join(root,'.verification') + path.sep));
    fs.rmSync(directory,{recursive:true,force:true});
  }
});
