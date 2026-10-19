'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const directory = path.join(root, '.verification', 'allocation-inputs');
fs.mkdirSync(directory, {recursive:true});
const {datasets} = require('../datasets.cjs');
const inputs = Object.entries(datasets()).filter(([name]) => ['tiny','unicode','dependency-lock'].includes(name));
const files = inputs.map(([name,value]) => {
  const filename = path.join(directory, `${name}.json`);
  fs.writeFileSync(filename, JSON.stringify(value));
  return filename;
});
files.push(path.join(__dirname, 'data', 'cldr-bn-languages.json'));
const executable = path.join(__dirname, 'target', 'release', `allocations${process.platform === 'win32' ? '.exe' : ''}`);
const now = new Date().toISOString();
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const sources = ['benches/profiling/src/bin/allocations.rs','benches/profiling/allocations.cjs','benches/profiling/Cargo.toml','benches/profiling/Cargo.lock','src/engine.rs','src/tree.rs'];
const report = {
  date:now, command:'node benches/profiling/allocations.cjs', node:process.version,
  platform:process.platform, arch:process.arch, cpu:os.cpus()[0].model,
  rust:execFileSync('rustc',['-Vv'],{encoding:'utf8'}),
  commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  executableSha256:sha(fs.readFileSync(executable)),
  inputs:files.map(file=>({file:path.relative(root,file),sha256:sha(fs.readFileSync(file))})),
  sources:Object.fromEntries(sources.map(file=>[file,fs.readFileSync(path.join(root,file),'utf8')])),
  results:JSON.parse(execFileSync(executable,files,{encoding:'utf8'})),
  limitations:['Rust allocator counts only. Input loading and Node/V8 excluded. No instrumented timings used. Returned outputs retained until each region is sampled.'],
};
const output = path.join(__dirname,'results',`${now.replace(/[:.]/g,'-')}-${process.pid}-allocations.json`);
fs.writeFileSync(output,JSON.stringify(report,null,2),{flag:'wx'});
console.log(output);
console.table(report.results.map(row=>({file:row.inputFile,single:row.singleEngine.allocations,collectReallocations:row.batch32IteratorCollect.reallocations,preallocatedReallocations:row.batch32Preallocated.reallocations})));
