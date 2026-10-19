'use strict';
// Public package/version queries only. No credentials or project contents sent.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'docs/audits', new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(output, { recursive: true });
const runner = process.env.npm_execpath;
if (!runner) throw new Error('Run using pnpm audit:deps');
function command(binary, args) {
  const run = spawnSync(binary, args, { cwd: root, encoding: 'utf8', timeout: 60000, maxBuffer: 10 * 1024 * 1024 });
  return { command: [binary, ...args], status: run.status, stdout: run.stdout || '', stderr: run.stderr || '', error: run.error?.message };
}
function pnpm(args) {
  const binary = /\.(?:c?js|mjs)$/.test(runner) ? process.execPath : runner;
  return command(binary, [...(binary === process.execPath ? [runner] : []), ...args]);
}
async function main() {
  const npm = pnpm(['audit', '--json']);
  fs.writeFileSync(path.join(output, 'pnpm-audit.json'), JSON.stringify(npm, null, 2));
  const licenses = pnpm(['licenses', 'list', '--json']);
  fs.writeFileSync(path.join(output, 'npm-licenses.json'), JSON.stringify(licenses, null, 2));
  const metadata = command('cargo', ['metadata', '--locked', '--format-version', '1']);
  if (metadata.status !== 0) throw new Error(metadata.stderr);
  const packages = JSON.parse(metadata.stdout).packages;
  const crates = packages.filter(pkg => pkg.source?.startsWith('registry+'));
  fs.writeFileSync(path.join(output, 'rust-licenses.json'), JSON.stringify(packages.map(pkg => ({
    name: pkg.name, version: pkg.version, license: pkg.license, source: pkg.source,
  })), null, 2));
  const queries = crates.map(pkg => ({ package: { name: pkg.name, ecosystem: 'crates.io' }, version: pkg.version }));
  const osv = { source: 'https://api.osv.dev/v1/querybatch', date: new Date().toISOString(), queries };
  try {
    const response = await fetch(osv.source, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ queries }), signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`OSV HTTP ${response.status}`);
    osv.response = await response.json();
    if (osv.response.results.length !== queries.length) throw new Error('OSV result count differs');
    if (osv.response.results.some(result => result.next_page_token)) throw new Error('OSV pagination required; audit incomplete');
  } catch (error) { osv.error = error.message; }
  fs.writeFileSync(path.join(output, 'rust-osv.json'), JSON.stringify(osv, null, 2));
  console.log(`Audit artifacts: ${path.relative(root, output)}`);
  console.log(`pnpm audit exit ${npm.status}; licenses exit ${licenses.status}; crates ${crates.length}; OSV ${osv.error || 'queried'}`);
  if (osv.error || npm.status !== 0 || licenses.status !== 0 || osv.response.results.some(result => result.vulns?.length)) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
