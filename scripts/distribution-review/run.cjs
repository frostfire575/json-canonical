'use strict';
// Local feasibility experiment only: no registry publication or root mutation.
// Invoke with `pnpm exec node scripts/distribution-review/run.cjs`.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
assert.equal(process.platform + '/' + process.arch, 'win32/x64', 'prototype requires genuine Windows x64 addon');
const runner = process.env.npm_execpath;
assert.ok(runner && fs.existsSync(runner), 'invoke through pnpm exec');
const metadataNode = process.env.NAPI_METADATA_NODE ? path.resolve(process.env.NAPI_METADATA_NODE) : process.execPath;
assert.ok(fs.existsSync(metadataNode), 'NAPI_METADATA_NODE must name an existing Node executable');
const base = path.join(root, '.verification', `distribution-${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`);
fs.mkdirSync(base, { recursive: true });
const write = (file, value) => fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const report = { date: new Date().toISOString(), platform: process.platform, arch: process.arch, versions: process.versions,
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  scriptSha256: sha(__filename), loaderSha256: sha(path.join(root, 'native/binding.js')),
  metadataNode, commands: [], generated: [], consumers: [], status: 'IN_PROGRESS' };
const temp = path.join(base, 'tmp'); fs.mkdirSync(temp);
const env = { ...process.env, TMP: temp, TEMP: temp, TMPDIR: temp, npm_config_cache: path.join(base, 'npm-cache'),
  npm_config_update_notifier: 'false', NAPI_RS_ENFORCE_VERSION_CHECK: '1' };
function run(binary, args, cwd, overrides = {}) {
  const item = { binary, args, cwd: path.relative(root, cwd), status: null }; report.commands.push(item);
  try {
    const output = execFileSync(binary, args, { cwd, env: { ...env, ...overrides }, encoding: 'utf8', timeout: 30000, maxBuffer: 256 * 1024 });
    item.status = 0; item.output = output; return output;
  } catch (error) {
    item.status = error.status; item.code = error.code; item.signal = error.signal;
    for (const stream of ['stdout', 'stderr']) {
      const output = error[stream];
      if (!output) continue;
      const artifact = path.join(base, `command-${report.commands.length}-${stream}.log`);
      write(artifact, output); item[stream] = { artifact: path.relative(root, artifact), sha256: sha(artifact), bytes: Buffer.byteLength(output), excerpt: output.slice(0, 2048) };
    }
    throw error;
  }
}
const npm = (args, cwd) => run(process.execPath, [path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'), ...args], cwd);
const pnpm = (args, cwd) => /\.(?:c?js|mjs)$/.test(runner)
  ? run(process.execPath, [runner, ...args], cwd) : run(runner, args, cwd);
function pack(directory, destination) {
  fs.mkdirSync(destination);
  const result = JSON.parse(npm(['pack', '--ignore-scripts', '--json', '--pack-destination', destination], directory));
  const file = path.join(destination, result[0].filename);
  return { file, bytes: fs.statSync(file).size, sha256: sha(file), files: result[0].files.map(x => x.path) };
}
try {
  report.npmVersion = npm(['--version'], root).trim();
  report.pnpmVersion = pnpm(['--version'], root).trim();
  report.metadataNodeVersion = run(metadataNode, ['--version'], root).trim();
  const metadata = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const generatedRoot = path.join(base, 'generated'); fs.mkdirSync(generatedRoot);
  write(path.join(generatedRoot, 'package.json'), metadata);
  const cli = path.join(path.dirname(require.resolve('@napi-rs/cli/package.json')), 'dist/cli.js');
  run(metadataNode, [cli, 'create-npm-dirs', '--cwd', generatedRoot], root);
  for (const target of ['win32-x64-msvc', 'linux-x64-gnu', 'darwin-arm64']) {
    const file = path.join(generatedRoot, 'npm', target, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(pkg.name, `stable-json-rs-${target}`); assert.equal(pkg.version, metadata.version);
    report.generated.push(pkg);
  }
  const platformName = 'stable-json-rs-win32-x64-msvc';
  const nativeName = 'stable-json-rs.win32-x64-msvc.node';
  const platformDir = path.join(generatedRoot, 'npm/win32-x64-msvc');
  for (const file of [nativeName]) fs.copyFileSync(path.join(root, 'native', file), path.join(platformDir, file));
  // napi metadata does not copy the native third-party notices itself.
  for (const file of ['LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES.txt']) fs.copyFileSync(path.join(root, file), path.join(platformDir, file));
  const platformMetaFile = path.join(platformDir, 'package.json');
  const platformMeta = JSON.parse(fs.readFileSync(platformMetaFile, 'utf8'));
  platformMeta.files.push('NOTICE', 'THIRD_PARTY_NOTICES.txt');
  fs.writeFileSync(platformMetaFile, JSON.stringify(platformMeta, null, 2) + '\n');
  report.platformArtifact = pack(platformDir, path.join(base, 'platform-tar'));
  assert.ok(report.platformArtifact.files.includes(nativeName));
  assert.ok(report.platformArtifact.files.includes('THIRD_PARTY_NOTICES.txt'));
  report.nativeSha256 = sha(path.join(platformDir, nativeName));
  const wrapperDir = path.join(base, 'wrapper'); fs.mkdirSync(wrapperDir);
  fs.cpSync(path.join(root, 'js'), path.join(wrapperDir, 'js'), { recursive: true });
  fs.mkdirSync(path.join(wrapperDir, 'native'));
  for (const file of ['binding.js', 'binding.d.ts']) fs.copyFileSync(path.join(root, 'native', file), path.join(wrapperDir, 'native', file));
  for (const file of ['LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES.txt']) fs.copyFileSync(path.join(root, file), path.join(wrapperDir, file));
  const wrapperMeta = { ...metadata, scripts: undefined, devDependencies: undefined, packageManager: undefined,
    files: ['js/dist', 'js/index.cjs', 'js/index.mjs', 'js/index.d.mts', 'native', 'LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES.txt'],
    // Deliberately local absolute tarball reference; never a registry-ready spec.
    optionalDependencies: { [platformName]: 'file:' + report.platformArtifact.file.replace(/\\/g, '/') } };
  write(path.join(wrapperDir, 'package.json'), wrapperMeta);
  report.wrapperArtifact = pack(wrapperDir, path.join(base, 'wrapper-tar'));
  assert.ok(!report.wrapperArtifact.files.some(x => x.endsWith('.node')), 'root prototype has no bundled binary');
  const verify = `
    const fs = require('node:fs'), assert = require('node:assert/strict'), crypto = require('node:crypto');
    const api = require('stable-json-rs');
    assert.equal(api.stringify({z:1,a:2}), '{"a":2,"z":1}');
    const expected = process.argv[2];
    (async () => {
      const esm = await import('stable-json-rs');
      assert.equal(esm.stringify, api.stringify);
      if (expected === 'missing') {
        assert.throws(() => api.stringifyJson('{}'), /Cannot find native binding/);
        console.log(JSON.stringify({status:'PASS', mode:expected, compatibilityAvailable:true})); return;
      }
      assert.equal(api.stringifyJson('{"z":1,"a":2}'), '{"a":2,"z":1}');
      assert.equal(esm.selectJson('{"a":[10,20]}', '/a/1'), '20');
      assert.deepEqual(api.stringifyJsonBatch(['{"b":2,"a":1}']), ['{"a":1,"b":2}']);
      const nativePaths = Object.keys(require.cache).filter(file=>file.endsWith('.node'));
      assert.equal(nativePaths.length, 1); assert.match(nativePaths[0], /stable-json-rs-win32-x64-msvc/);
      const hash = crypto.createHash('sha256').update(fs.readFileSync(nativePaths[0])).digest('hex');
      assert.equal(hash, process.argv[3]);
      // pnpm intentionally does not expose a transitive optional package from
      // the application. Resolve from its actual declaring wrapper instead.
      const wrapperRequire = require('node:module').createRequire(require.resolve('stable-json-rs'));
      assert.equal(wrapperRequire('stable-json-rs-win32-x64-msvc/package.json').version, '0.1.0');
      console.log(JSON.stringify({status:'PASS', mode:expected, loadedNative:nativePaths[0], sha256:hash}));
    })().catch(error=>{console.error(error);process.exitCode=1});
  `;
  for (const manager of ['npm', 'pnpm']) {
    for (const mode of ['present', 'missing', ...(manager === 'npm' ? ['filtered'] : [])]) {
      const consumer = path.join(base, `${manager}-${mode}`); fs.mkdirSync(consumer);
      write(path.join(consumer, 'package.json'), { name: `distribution-${manager}-${mode}`, private: true });
      write(path.join(consumer, 'verify.cjs'), verify);
      // --os only tests npm metadata filtering; it does not execute Linux code.
      const optional = mode === 'filtered' ? ['--os=linux', '--cpu=x64']
        : mode === 'missing' ? (manager === 'npm' ? ['--omit=optional'] : ['--no-optional']) : [];
      if (manager === 'npm') npm(['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', ...optional, report.wrapperArtifact.file], consumer);
      else pnpm(['add', '--offline', '--ignore-scripts', '--store-dir', path.join(base, 'pnpm-store'), ...optional, report.wrapperArtifact.file], consumer);
      const result = JSON.parse(run(process.execPath, ['verify.cjs', mode === 'present' ? 'present' : 'missing', report.nativeSha256], consumer));
      if (mode === 'present') {
        write(path.join(consumer, 'types.cts'), `import api = require('stable-json-rs'); const result: string = api.stringifyJson('{}'); void result;\n`);
        write(path.join(consumer, 'types.mts'), `import {selectJson} from 'stable-json-rs'; const result: string | undefined = selectJson('{}', '/x'); void result;\n`);
        write(path.join(consumer, 'tsconfig.json'), { compilerOptions: { target:'ES2022', module:'NodeNext', moduleResolution:'NodeNext', strict:true, noEmit:true, skipLibCheck:false }, include:['types.cts','types.mts'] });
        run(process.execPath, [path.join(path.dirname(require.resolve('typescript/package.json')), 'bin/tsc'), '-p', consumer], consumer);
      }
      report.consumers.push({ manager, ...result, mode });
      if (mode === 'present') {
        // Corrupt only this throwaway installed metadata, then start a fresh
        // process to check the generated loader's opt-in version guard.
        const manifest = path.join(path.dirname(result.loadedNative), 'package.json');
        const original = fs.readFileSync(manifest, 'utf8');
        try {
          const mismatched = JSON.parse(original); mismatched.version = '0.1.1';
          fs.writeFileSync(manifest, JSON.stringify(mismatched));
          const mismatchCode = `const assert=require('node:assert/strict');const api=require('stable-json-rs');assert.equal(api.stringify({a:1}),'{"a":1}');assert.throws(()=>api.stringifyJson('{}'),error=>{let current=error;for(let i=0;current&&i<20;i++,current=current.cause){if(/version mismatch, expected 0.1.0 but got 0.1.1/.test(current.message))return true;}return false});console.log('opt-in version mismatch PASS')`;
          run(process.execPath, ['-e', mismatchCode], consumer);
          report.consumers.push({ manager, mode: 'version-mismatch', status: 'PASS', optInEnforcement: true });
        } finally { fs.writeFileSync(manifest, original); }
      }
    }
  }
  report.status = 'PASS';
} catch (error) { report.status = 'FAIL'; report.error = `${error.name}: ${error.code || ''} ${String(error.message).slice(0, 2048)}`; process.exitCode = 1; }
finally {
  write(path.join(base, 'report.json'), report);
  console.log(JSON.stringify({ status: report.status, directory: path.relative(root, base), consumers: report.consumers.length, error: report.error }));
}
