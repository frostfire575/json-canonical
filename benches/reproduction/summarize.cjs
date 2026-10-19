'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const manifestPath = process.argv[2];
if (!manifestPath) throw new Error('Usage: node benches/reproduction/summarize.cjs <coverage-manifest>');
const manifest = JSON.parse(fs.readFileSync(path.resolve(root, manifestPath)));
const render = value => Number(value).toLocaleString('en-US', { maximumFractionDigits: 1 });
const lines = [`# Coverage evidence — ${manifest.timestamp}`, '', `Runner snapshot: ${manifest.snapshot}; SHA-256 ${manifest.runnerSha256}.`, '', 'All rates are median operations/s. Each pair retains run 1 / run 2; each cell has nine samples. Exact outputs are checked before measurement. Data loading and construction are excluded. Memory includes setup and is not a serializer-only peak.', ''];
for (const group of manifest.groups) {
  const raw = JSON.parse(fs.readFileSync(path.resolve(root, group.artifact)));
  lines.push(`## ${group.name}`, '', `Raw: ${group.artifact}`, '', `Config: ${JSON.stringify(raw.config)}`, '', '| Dataset | Method | Run 1 / 2 ops/s | Run 1 / 2 MAD % |', '|---|---|---:|---:|');
  const pairs = new Map();
  for (const cell of raw.results) {
    const key = `${cell.dataset}/${cell.method}`;
    if (!pairs.has(key)) pairs.set(key, []);
    pairs.get(key)[cell.run - 1] = cell;
  }
  for (const [key, cells] of [...pairs].sort(([a], [b]) => a.localeCompare(b))) {
    const [dataset, method] = key.split('/');
    lines.push(`| ${dataset} | ${method} | ${cells.map(cell => render(cell.medianOpsPerSecond)).join(' / ')} | ${cells.map(cell => render(cell.madPercent)).join(' / ')} |`);
  }
  lines.push('');
  if (group.name === 'cache-pools' || group.name === 'batch-elements') {
    const cache = group.name === 'cache-pools';
    const numerator = cache ? 'cache-pool' : 'native-batch-elements';
    const denominator = cache ? 'public-pool' : 'native-loop-elements';
    lines.push(`Throughput change: ${numerator} relative to ${denominator}.`, '', '| Dataset | Run 1 / 2 change |', '|---|---:|');
    const datasets = [...new Set(raw.results.map(cell => cell.dataset))].sort();
    for (const dataset of datasets) {
      const changes = [1, 2].map(run => {
        const find = method => raw.results.find(cell => cell.dataset === dataset && cell.run === run && cell.method === method).medianOpsPerSecond;
        const percentage = (find(numerator) / find(denominator) - 1) * 100;
        return `${percentage >= 0 ? '+' : ''}${render(percentage)}%`;
      });
      lines.push(`| ${dataset} | ${changes.join(' / ')} |`);
    }
    lines.push('');
  }
}
const output = path.join(__dirname, 'results', `${manifest.timestamp.replace(/[:.]/g, '-')}-coverage-summary.md`);
fs.writeFileSync(output, `${lines.join('\n')}\n`, { flag: 'wx' });
console.log(path.relative(root, output));
