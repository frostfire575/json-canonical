'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { median, hash } = require('./run.cjs');
function summarize(report) {
  assert.ok(report.finishedAt && !report.failure, 'Only completed evidence can be summarized');
  assert.ok(report.results.length);
  assert.equal(new Set(report.configuration.selected).size, report.configuration.selected.length);
  assert.equal(new Set(report.configuration.methods).size, report.configuration.methods.length);
  const groups = report.configuration.selected.map(id => {
    const methodData = Object.fromEntries(report.configuration.methods.map(method => {
      const cells = report.results.filter(cell => cell.id === id && cell.method === method).toSorted((a, b) => a.run - b.run);
      assert.equal(cells.length, report.configuration.repetitions, `${id}/${method} repeats`);
      assert.equal(new Set(cells.map(cell => cell.run)).size, cells.length, 'No duplicate repetition');
      assert.ok(cells.every(cell => cell.timed && cell.beforeExact && cell.afterExact && cell.beforeSha256 === cell.expectedSha256 && cell.afterSha256 === cell.expectedSha256));
      return [method, {
        opsPerSecondByRun: cells.map(cell => cell.medianOpsPerSecond), madPercentByRun: cells.map(cell => cell.madPercent),
        medianOpsPerSecondAcrossRuns: median(cells.map(cell => cell.medianOpsPerSecond)),
        microsecondsPerOperationByRun: cells.map(cell => cell.medianMicrosecondsPerOperation), inputMiBPerSecondByRun: cells.map(cell => cell.inputMiBPerSecond), outputMiBPerSecondByRun: cells.map(cell => cell.outputMiBPerSecond),
        processPeakRssMiBByRun: cells.map(cell => cell.resourceUsage.maxRSS / 1024),
        cpuMicrosecondsPerOperationByRun: cells.map(cell => (cell.cpuMicroseconds.user + cell.cpuMicroseconds.system) / cell.samples.reduce((total, sample) => total + sample.operations, 0)),
      }];
    }));
    const first = report.results.find(cell => cell.id === id);
    const ratios = {};
    for (const operation of ['sort', 'select']) {
      const baseline = methodData[`${operation}-direct-js`] ? `${operation}-direct-js` : `${operation}-js`;
      if (methodData[`${operation}-native`] && methodData[baseline]) {
        ratios[operation] = methodData[`${operation}-native`].opsPerSecondByRun.map((rate, index) => rate / methodData[baseline].opsPerSecondByRun[index]);
      }
    }
    return { id, inputBytes: first.inputBytes, source: first.source, transform: first.transform, methods: methodData, nativeVsJsRatioByRun: ratios };
  });
  assert.equal(groups.reduce((count, group) => count + Object.keys(group.methods).length * report.configuration.repetitions, 0), report.results.length, 'No extra ungrouped cells');
  return { schemaVersion: 1, startedAt: report.startedAt, finishedAt: report.finishedAt, environment: report.environment, configuration: report.configuration, candidate: report.candidate, cells: report.results.length, groups,
    caveats: 'Median across process medians does not replace raw within-run variation. CPU and process RSS include measurement overhead; peakRSS includes setup, not serializer-only allocation. Text sorting and selection are separate APIs, not compatible stringify acceleration.' };
}
if (require.main === module) {
  const file = path.resolve(process.argv[2]);
  const bytes = fs.readFileSync(file); const report = JSON.parse(bytes); const result = { sourceReport: file, sourceReportSha256: hash(bytes), ...summarize(report) };
  const output = file.replace(/\.json$/, '-summary.json'); assert.notEqual(file, output);
  fs.writeFileSync(output, JSON.stringify(result, null, 2), { flag: 'wx' });
  console.log(output);
}
module.exports = { summarize };
