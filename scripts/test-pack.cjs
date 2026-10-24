'use strict';
// Packs the package, installs the tarball into a fresh consumer with lifecycle
// scripts disabled, and exercises CJS, ESM and the native addon from there.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.join(__dirname, '..');
const shell = process.platform === 'win32';
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'inherit'], shell }).toString();

const out = fs.mkdtempSync(path.join(os.tmpdir(), 'json-canonical-pack-'));
run('pnpm', ['pack', '--pack-destination', out], root);
const tarball = fs.readdirSync(out).find((f) => f.endsWith('.tgz'));
const listing = run('tar', ['-tzf', tarball], out).split(/\r?\n/).filter(Boolean);
for (const required of ['package/js/dist/index.js', 'package/js/index.mjs', 'package/native/binding.js', 'package/LICENSE']) {
  if (!listing.includes(required)) throw new Error(`tarball is missing ${required}`);
}
if (!listing.some((f) => f.endsWith('.node'))) throw new Error('tarball has no native addon');
const unexpected = listing.filter((f) => /^package\/(crates|tests|benches|target|upstream)\//.test(f));
if (unexpected.length) throw new Error(`tarball contains development files: ${unexpected.join(', ')}`);

const consumer = path.join(out, 'consumer');
fs.mkdirSync(consumer);
fs.writeFileSync(path.join(consumer, 'package.json'), JSON.stringify({ name: 'consumer', private: true }));
run('npm', ['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', path.join(out, tarball)], consumer);
fs.writeFileSync(path.join(consumer, 'smoke.cjs'), `
const assert = require('node:assert/strict');
const json = require('json-canonical');
assert.equal(json.canonicalize(' {"b":[1.0,1e21],"a":"\\\\u00e9"} '), '{"a":"é","b":[1,1e+21]}');
assert.equal(json.sortKeys(Buffer.from('{"b":1.10,"a":2}')), '{"a":2,"b":1.10}');
assert.equal(json.select('{"a":[0,{"b":"x"}]}', '/a/1/b'), '"x"');
assert.throws(() => json.validate('{'), json.JsonError);
json.canonicalizeAsync('[2,1]').then((v) => assert.equal(v, '[2,1]'));
`);
fs.writeFileSync(path.join(consumer, 'smoke.mjs'), `
import assert from 'node:assert/strict';
import { canonicalHash, equal } from 'json-canonical';
assert.equal(equal('{"a":1}', '{ "a": 1.0 }'), true);
assert.equal(canonicalHash('{}'), '44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a');
`);
const node = process.env.CONSUMER_NODE ?? process.execPath;
run(node, ['smoke.cjs'], consumer);
run(node, ['smoke.mjs'], consumer);
fs.writeFileSync(path.join(consumer, 'in.json'), '{"b":2,"a":1}');
// Runs the installed bin shims, so a wrong `bin` path or a missing shebang fails here.
for (const name of ['json-canonical', 'jcanon']) {
  const bin = path.join(consumer, 'node_modules', '.bin', name);
  if (run(bin, ['canonicalize', 'in.json'], consumer) !== '{"a":1,"b":2}') throw new Error(`${name} bin printed the wrong output`);
}
console.log(`packed ${tarball} (${listing.length} files) installed and verified with ${run(node, ['--version'], consumer).trim()} in ${consumer}`);
