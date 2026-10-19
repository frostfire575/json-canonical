'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync, execFileSync } = require('node:child_process');
const { shuffled, median } = require('./run.cjs');
const root = path.resolve(__dirname, '../..');
const stamp = new Date().toISOString();
const methods = [['wrapper', './js/index.cjs'], ['actual-native', './native/binding.js'], ['upstream', './upstream/fast-json-stable-stringify']];
const results = [];
for (let run = 1; run <= 2; run++) {
  for (const [method, modulePath] of shuffled(methods, 12815 + run)) {
    const samples = [];
    for (let i = 0; i < 5; i++) {
      const program = `const {performance}=require('node:perf_hooks');const started=performance.now();require(${JSON.stringify(modulePath)});const elapsedMs=performance.now()-started;const fs=require('node:fs');const crypto=require('node:crypto');const native=Object.keys(require.cache).filter(file=>file.endsWith('.node')).map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));process.stdout.write(JSON.stringify({elapsedMs,native}));`;
      const child = spawnSync(process.execPath, ['-e', program], { cwd: root, encoding: 'utf8', timeout: 30000 });
      if (child.status !== 0) throw new Error(child.stderr || String(child.error));
      samples.push(JSON.parse(child.stdout));
    }
    const times = samples.map(sample => sample.elapsedMs);
    const middle = median(times);
    results.push({ run, method, modulePath, samples, medianRequireMs: middle, madPercent: median(times.map(value => Math.abs(value - middle))) * 100 / middle, minRequireMs: Math.min(...times), maxRequireMs: Math.max(...times) });
    console.log(`${run} ${method} ${middle.toFixed(3)}ms`);
  }
}
const report = { timestamp: stamp, command: 'node benches/reproduction/cold-start.cjs', environment: { node: process.version, v8: process.versions.v8, platform: process.platform, arch: process.arch, osRelease: os.release(), cpu: os.cpus()[0]?.model,
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), dirty: execFileSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8' }).trim(), sourceSha256: crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex') },
  contract: 'Fresh Node process for each require, five samples per method per run, two shuffled serial runs; timer includes require only and excludes Node startup and metadata extraction. Wrapper uses lazy native loading; actual-native separately loads real .node binding. OS filesystem/disk cache may already be warm. No filesystem-cache eviction or cold-machine claim.', results };
const filename = path.join(__dirname, 'results', `${stamp.replace(/[:.]/g, '-')}-${process.pid}-cold-start.json`);
fs.writeFileSync(filename, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
console.log(path.relative(root, filename));
