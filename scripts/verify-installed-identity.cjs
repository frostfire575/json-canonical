'use strict';
// Bind packed-consumer checks to the exact runtime files tested in this checkout.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
assert.ok(process.argv[2], 'Usage: node scripts/verify-installed-identity.cjs CANDIDATE_DIRECTORY');
const directory = path.resolve(process.argv[2]);
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const manifest = read(path.join(directory, 'candidate.json'));
assert.equal(path.basename(manifest.filename), manifest.filename);
assert.equal(sha(path.join(directory, manifest.filename)), manifest.sha256);
const binaries = {
  'win32/x64': 'stable-json-rs.win32-x64-msvc.node',
  'linux/x64': 'stable-json-rs.linux-x64-gnu.node',
  'darwin/arm64': 'stable-json-rs.darwin-arm64.node',
};
const binary = binaries[`${process.platform}/${process.arch}`];
assert.ok(binary, 'supported host required');
const reports = fs.readdirSync(directory).filter(file => /^verification-.*\.json$/.test(file))
  .map(file => read(path.join(directory, file)));
assert.ok(reports.length >= 2, 'npm and pnpm installed verification reports required');
for (const report of reports) {
  assert.equal(report.status, 'PASS');
  assert.equal(report.sha256, manifest.sha256);
}
const files = ['js/dist/index.js', 'js/dist/index.d.ts', 'js/index.cjs', 'js/index.mjs',
  'js/index.d.mts', 'native/binding.js', 'native/binding.d.ts', `native/${binary}`];
const consumers = ['npm', 'pnpm'].map(manager => {
  assert.ok(reports.some(report => report.manager === manager));
  const consumerRequire = createRequire(path.join(directory, manager, 'package.json'));
  const installed = path.dirname(path.dirname(consumerRequire.resolve('stable-json-rs')));
  const api = consumerRequire('stable-json-rs');
  assert.equal(api.stringifyJson('{"z":2,"a":1}'), '{"a":1,"z":2}');
  const identities = files.map(file => {
    const sha256 = sha(path.join(installed, file));
    assert.equal(sha256, sha(path.join(root, file)), `${manager}/${file}`);
    return { file, sha256 };
  });
  const loaded = Object.keys(require.cache).filter(file => file.endsWith('.node') && file.startsWith(installed + path.sep));
  assert.equal(loaded.length, 1, 'installed local addon loaded');
  assert.equal(sha(loaded[0]), sha(path.join(root, 'native', binary)));
  assert.ok(fs.existsSync(path.join(installed, 'docs/performance.md')));
  return { manager, installed, loadedNative: loaded[0], files: identities };
});
const date = new Date().toISOString();
const output = path.join(directory, `source-identity-${date.replace(/[:.]/g, '-')}-${process.pid}.json`);
fs.writeFileSync(output, JSON.stringify({ ...manifest, date, node: process.version,
  command: `node scripts/verify-installed-identity.cjs ${path.relative(root, directory)}`,
  verifierSha256: sha(__filename), status: 'PASS', consumers,
  verificationReports: reports.map(({manager, node, status, sha256}) => ({manager, node, status, sha256})),
  limitations: ['Only the current host addon is loaded. Identity is not cross-platform runtime verification.'],
}, null, 2), {flag: 'wx'});
console.log(`PASS: installed runtime files match tested source; ${output}`);
