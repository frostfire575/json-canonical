'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const file = process.argv[2];
assert.ok(file, 'node benches/public-api/summarize.cjs RAW.json');
const report = JSON.parse(fs.readFileSync(file));
const rows = [];
for (const dataset of report.configuration.selectedDatasets) {
  for (let run = 1; run <= report.configuration.repetitions; run++) {
    const cells = report.results.filter(cell => cell.dataset === dataset && cell.run === run);
    for (const cell of cells) {
      const baseline = cells.find(candidate => candidate.method === (cell.method.includes('select') ? 'upstream-select-text' : cell.method.includes('text') ? 'upstream-text' : cell.method.includes('batch') || cell.method === 'loop-current' ? 'batch-original' : 'upstream'));
      assert.ok(baseline);
      rows.push({ dataset, run, method: cell.method, medianOpsPerSecond: cell.medianOpsPerSecond, madPercent: cell.madPercent,
      baselineMethod: baseline.method, throughputDeltaPercent: (cell.medianOpsPerSecond / baseline.medianOpsPerSecond - 1) * 100,
      latencyMicroseconds: cell.latencyMicroseconds, exact: cell.exact });
    }
  }
}
fs.writeFileSync(`${file.slice(0, -5)}-summary.json`, JSON.stringify({ raw: file, rows }, null, 2), { flag: 'wx' });
for (const row of rows) console.log(`${row.dataset}\trun${row.run}\t${row.method}\t${row.medianOpsPerSecond.toFixed(1)} ops/s\tMAD ${row.madPercent.toFixed(2)}%\t${row.throughputDeltaPercent.toFixed(2)}% vs ${row.baselineMethod}`);
