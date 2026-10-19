'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const { execFileSync } = require('node:child_process');
const { BatchProbe } = require('./native/binding');
const api = require('../../js/index.cjs');
const oracle = require('../../upstream/fast-json-stable-stringify');
const root = path.resolve(__dirname, '../..');
let sink = 0;
function consume(result) {
  if (typeof result === 'number') { sink = (sink + result) >>> 0; return; }
  for (const text of result) sink = (sink + text.length + text.charCodeAt(text.length >>> 1)) >>> 0;
}
function burst(fn, ms) {
  let count = 0;
  const start = performance.now();
  do { for (let i = 0; i < 16; i++) { consume(fn()); count++; } } while (performance.now() - start < ms);
  return { count, elapsedMs: performance.now() - start };
}
const median = xs => [...xs].sort((a,b) => a-b)[xs.length >>> 1];
const rows = [];
const comments = JSON.parse(fs.readFileSync(path.join(root, 'benches/data/jsonplaceholder-data.json'))).comments;
for (const [dataset, values] of [
  ['tiny', Array.from({length:32}, (_,i) => ({z:i,a:{state:true,message:`row ${i}`}}))],
  ['real-comments', comments.slice(0,32)],
]) {
  const inputs = values.map(value => JSON.stringify(value));
  const expected = values.map(value => oracle(value));
  const probe = new BatchProbe(inputs);
  const guard = () => {
    if (!Array.isArray(inputs) || inputs.some(input => typeof input !== 'string')) throw new Error('type');
    let total = 0;
    for (const input of inputs) { if (!input.isWellFormed()) throw new Error('UTF16'); total += Buffer.byteLength(input); }
    return total;
  };
  const methods = {
    boundary: [()=>probe.boundary(), 32],
    'wrapper-validation-only': [guard, inputs.reduce((n,s)=>n+Buffer.byteLength(s),0)],
    'input-conversion-only': [()=>probe.acceptInputs(inputs), inputs.reduce((n,s)=>n+Buffer.byteLength(s),0)],
    'output-clone-and-conversion-only': [()=>probe.storedOutputs(), expected],
    'stored-engine-return-length': [()=>probe.storedEngine(), expected.reduce((n,s)=>n+Buffer.byteLength(s),0)],
    'probe-sort-collected': [()=>probe.sortCollected(inputs), expected],
    'probe-sort-preallocated': [()=>probe.sortPreallocated(inputs), expected],
    'public-native-batch': [()=>api.stringifyJsonBatch(inputs), expected],
    'public-native-loop': [()=>inputs.map(s=>api.stringifyJson(s)), expected],
  };
  for (const [name,[fn,expectedValue]] of Object.entries(methods)) {
    assert.deepEqual(fn(), expectedValue);
    burst(fn,300);
    const samples = Array.from({length:9},()=>burst(fn,100));
    const durations = samples.map(s=>s.elapsedMs*1000/s.count);
    const us = median(durations);
    const result = {dataset,name,medianUs:us,madPercent:median(durations.map(n=>Math.abs(n-us)))*100/us,samples,sink};
    rows.push(result); console.log(`${dataset} ${name}: ${us.toFixed(3)} us MAD${result.madPercent.toFixed(1)}%`);
  }
}
const now = new Date().toISOString();
const files = ['benches/profiling/src/lib.rs','benches/profiling/batch.cjs','js/dist/index.js','src/lib.rs'];
const report = {date:now,command:'node benches/profiling/batch.cjs',node:process.version,cpu:os.cpus()[0].model,
  commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sources:Object.fromEntries(files.map(file=>[file,fs.readFileSync(path.join(root,file),'utf8')])),
  artifact:fs.readdirSync(path.join(__dirname,'native')).filter(f=>f.endsWith('.node')).map(f=>({file:f,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'native',f))).digest('hex')})),
  results:rows,limitations:['Probe class overhead differs from public free functions. Stage durations include combined allocation/copy/encoding and cannot be naively added/subtracted.','Array outputs consumed identically per item without extra JSON.stringify. No V8 allocation counts.']};
const filename = path.join(__dirname,'results',`${now.replace(/[:.]/g,'-')}-${process.pid}-batch.json`);
fs.mkdirSync(path.dirname(filename),{recursive:true});
fs.writeFileSync(filename,JSON.stringify(report,null,2),{flag:'wx'});
console.log(`Raw batch profiling: ${filename}`);
