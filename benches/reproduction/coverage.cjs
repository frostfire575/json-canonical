'use strict';
// Serial coordinator. Child runner owns measurements; no concurrent benchmark cells.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const densityControls = 'latin1-large,sparse-unicode,ascii-string-50k,short-unicode,real-cldr-bn,unicode-prefix-ascii-tail,ascii-prefix-unicode-tail,ascii-prefix-dense-unicode';
const plans = {
  'text-gaps': { datasets: 'tiny,deep,wide,application-config,upstream-api-fixture,large-string,record-array,backend-payload,array-of-32', methods: 'oracle,native' },
  'object-matrix': { datasets: 'tiny,deep,wide,application-config,upstream-api-fixture,large-string,record-array,backend-payload,array-of-32,lock-normalized,api-normalized,unicode', methods: 'object-oracle,object-public,object-native-roundtrip,object-safe-stable,object-fast-stable,JSON-context' },
  selection: { datasets: 'tiny,deep,wide,lock-normalized,api-normalized,unicode', methods: 'select-native-text,select-oracle-text,select-native-scalar,select-oracle-scalar' },
  'batch-elements': { datasets: 'batch-api-elements-1,batch-api-elements-8,batch-api-elements-32,batch-api-elements-128', methods: 'native-batch-elements,native-loop-elements,oracle-loop-elements' },
  'cache-pools': { datasets: [32, 128].flatMap(size => [0, 50, 90, 99].map(hit => `cache-pool-${size}-hit${hit}`)).join(','), methods: 'cache-pool,public-pool,oracle-pool' },
  'length-sensitivity': { datasets: 'lock-normalized,unicode', methods: 'oracle,native', warmupMs: '1000', consumption: 'length' },
  'encoding-controls': { datasets: 'latin1-large,sparse-unicode,ascii-string-50k,short-unicode,real-cldr-bn', methods: 'oracle,native' },
  'candidate-text': { datasets: 'lock-normalized,api-normalized,unicode', methods: 'oracle,native', warmupMs: '1000' },
  'candidate-roundtrip': { datasets: 'tiny,deep,wide,application-config,upstream-api-fixture,large-string,record-array,backend-payload,array-of-32,lock-normalized,api-normalized,unicode', methods: 'object-native-roundtrip' },
  'archive-encoding-controls': { datasets: densityControls, methods: 'oracle,native', archive: true },
  'revised-encoding-controls': { datasets: densityControls, methods: 'oracle,native' },
  'archive-basic-controls': { datasets: densityControls.split(',').slice(0, 5).join(','), methods: 'oracle,native', archive: true },
  'archive-batch-one-confirm': { datasets: 'batch-api-elements-1', methods: 'native-batch-elements,native-loop-elements', archive: true, warmupMs: '1000' },
  'revised-batch-one-confirm': { datasets: 'batch-api-elements-1', methods: 'native-batch-elements,native-loop-elements', warmupMs: '1000' },
};
const selection = process.argv.slice(2);
const groups = selection.length ? selection : ['text-gaps', 'object-matrix', 'selection', 'batch-elements', 'cache-pools', 'length-sensitivity'];
const stamp = new Date().toISOString();
const runner = path.join(__dirname, 'run.cjs');
const source = fs.readFileSync(runner);
const runnerSha256 = crypto.createHash('sha256').update(source).digest('hex');
const snapshot = path.join(__dirname, `run-${runnerSha256.slice(0, 12)}.cjs`);
if (!fs.existsSync(snapshot)) fs.writeFileSync(snapshot, source, { flag: 'wx' });
const manifest = { timestamp: stamp, command: `node benches/reproduction/coverage.cjs${selection.length ? ` ${selection.join(' ')}` : ''}`, runnerSha256, snapshot: path.relative(root, snapshot), groups: [] };
for (const group of groups) {
  const plan = plans[group];
  if (!plan) throw new Error(`Unknown coverage group ${group}`);
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('REPRO_') && key !== 'NAPI_RS_NATIVE_LIBRARY_PATH'));
  Object.assign(env, { REPRO_DATASETS: plan.datasets, REPRO_METHODS: plan.methods, REPRO_RUNS: '2', REPRO_SAMPLES: '9', REPRO_SAMPLE_MS: '100', REPRO_WARMUP_MS: plan.warmupMs || '300', REPRO_CONSUMPTION: plan.consumption || 'flatten' });
  if (plan.archive) Object.assign(env, {
    NAPI_RS_NATIVE_LIBRARY_PATH: path.join(root, '.verification/baseline-native/stable-json-rs.win32-x64-msvc.node'),
    REPRO_ARTIFACT_SOURCE_REF: '113a8eb79dbf7350d1f15a7e639d7a5e2492abee',
    REPRO_EXPECT_NATIVE_SHA: '154d1683ec0db600a2053528c08d776ac123367fb9afee573cb173466c14e0a1',
  });
  process.stdout.write(`START ${group}\n`);
  const result = spawnSync(process.execPath, [runner], { cwd: root, env, encoding: 'utf8', timeout: 600000, maxBuffer: 4 * 1024 * 1024 });
  process.stdout.write(result.stdout || '');
  if (result.status !== 0) { process.stderr.write(result.stderr || String(result.error)); process.exitCode = 1; break; }
  const artifact = result.stdout.trim().split(/\r?\n/).at(-1);
  manifest.groups.push({ name: group, ...plan, artifact });
  fs.writeFileSync(path.join(__dirname, 'results', `${stamp.replace(/[:.]/g, '-')}-coverage-incomplete.json`), `${JSON.stringify(manifest, null, 2)}\n`);
}
const output = path.join(__dirname, 'results', `${stamp.replace(/[:.]/g, '-')}-coverage.json`);
fs.writeFileSync(output, `${JSON.stringify({ ...manifest, completed: manifest.groups.length === groups.length }, null, 2)}\n`, { flag: 'wx' });
console.log(path.relative(root, output));
