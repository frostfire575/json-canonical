'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const directory = path.join(root, '.pack-test', `${Date.now()}-${process.pid}`);
fs.mkdirSync(directory, { recursive: true });
// Run through `pnpm test:pack`; npm_execpath is the project runner, not a
// shell-built command, so paths and argument boundaries are preserved.
const runner = process.env.npm_execpath;
if (!runner) throw new Error('Run this check with pnpm test:pack');
function pnpm(args, cwd) {
  const binary = /\.(?:c?js|mjs)$/.test(runner) ? process.execPath : runner;
  const prefix = binary === process.execPath ? [runner] : [];
  return execFileSync(binary, [...prefix, ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}
pnpm(['pack', '--pack-destination', directory], root);
const filename = fs.readdirSync(directory).find(file => file.endsWith('.tgz'));
assert.ok(filename, 'packed tarball exists');
fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify({ name: 'stable-json-pack-test', private: true }));
if (process.argv.includes('--npm')) {
  const npmCli = path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
  console.log(execFileSync(process.execPath, [npmCli, 'install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', path.join(directory, filename)], { cwd: directory, encoding: 'utf8' }));
} else {
  console.log(pnpm(['add', '--offline', '--ignore-scripts', path.join(directory, filename)], directory));
}
fs.writeFileSync(path.join(directory, 'verify.cjs'), `
const assert = require('node:assert/strict');
const api = require('stable-json-rs');
assert.equal(api.stringify({z:1,a:2}), '{"a":2,"z":1}');
assert.equal(api.stringifyJson('{"z":1,"a":2}'), '{"a":2,"z":1}');
assert.deepEqual(api.stringifyJsonBatch(['{"z":1,"a":2}']), ['{"a":2,"z":1}']);
assert.equal(api.selectJson('{"a":[1,2]}', '/a/1'), '2');
assert.ok(require('node:fs').statSync(require('node:path').join(require('node:path').dirname(require.resolve('stable-json-rs')), '../THIRD_PARTY_NOTICES.txt')).size > 0);
import('stable-json-rs').then(esm => {
  assert.equal(esm.default({z:1,a:2}), '{"a":2,"z":1}');
  assert.equal(esm.stringifyJson('0'), '0');
  console.log('Packed CJS, ESM and release native APIs PASS');
}).catch(error => { console.error(error); process.exitCode = 1; });
`);
console.log(execFileSync(process.execPath, ['verify.cjs'], { cwd: directory, encoding: 'utf8' }));
fs.writeFileSync(path.join(directory, 'types.cts'), `
import api = require('stable-json-rs');
const text: string | undefined = api.stringify({a: 1});
const selected: string | undefined = api.selectJson('{"a":1}', '/a');
const batch: string[] = api.stringifyJsonBatch(['{}']);
api.createSerializerCache().stringify({}, 1);
void [text, selected, batch];
`);
fs.writeFileSync(path.join(directory, 'types.mts'), `
import stringify, {selectJson} from 'stable-json-rs';
const text: string | undefined = stringify({a: 1});
const selected: string | undefined = selectJson('{"a":1}', '/a');
void [text, selected];
`);
fs.writeFileSync(path.join(directory, 'tsconfig.json'), JSON.stringify({ compilerOptions: {
  target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, noEmit: true, skipLibCheck: true,
}, include: ['types.cts', 'types.mts'] }));
const tsManifest = require.resolve('typescript/package.json');
const tsBinary = path.resolve(path.dirname(tsManifest), JSON.parse(fs.readFileSync(tsManifest, 'utf8')).bin.tsc);
execFileSync(process.execPath, [tsBinary, '-p', directory], { cwd: directory, stdio: 'inherit' });
console.log('Packed CJS/ESM TypeScript consumers PASS');
console.log(`Artifact preserved: ${path.join(directory, filename)}`);
