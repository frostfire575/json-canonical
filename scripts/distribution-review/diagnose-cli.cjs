'use strict';
// Bounded local toolchain diagnosis, never builds/publishes native code.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const base = path.join(root, '.verification', `napi-cli-diagnostic-${Date.now()}-${process.pid}`);
fs.mkdirSync(base, {recursive:true});
const cli = path.join(path.dirname(require.resolve('@napi-rs/cli/package.json')), 'dist/cli.js');
const results = [];
const statsProbe = `
 const fs = require('node:fs'); const path = require('node:path');
 const file = path.join(process.argv[1], 'identity.txt');
 fs.writeFileSync(file, 'identity'); const fd = fs.openSync(file, 'r');
 const fields = s => ({dev:String(s.dev),ino:String(s.ino),mode:String(s.mode)});
 const fromFd = fields(fs.fstatSync(fd,{bigint:true}));
 const before = fields(fs.lstatSync(file,{bigint:true}));
 fs.renameSync(file,file+'.renamed'); const after = fields(fs.lstatSync(file+'.renamed',{bigint:true}));
 fs.closeSync(fd); console.log(JSON.stringify({fromFd,before,after,fdMatchesPath:fromFd.dev===before.dev&&fromFd.ino===before.ino}));
`;
for (const binary of [process.execPath, path.join(root, '.tools/node-v22.13.0-win-x64/node.exe')]) {
  for (const operation of ['identity', 'help', 'generate']) {
    const directory = path.join(base, `${path.basename(path.dirname(binary))}-${operation}`); fs.mkdirSync(directory);
    fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify({name:'stable-json-rs', version:'0.1.0', license:'MIT', napi:{binaryName:'stable-json-rs',targets:['x86_64-pc-windows-msvc']}}));
    const args = operation==='identity' ? ['-e',statsProbe,directory]
      : [cli, ...(operation==='help' ? ['--help'] : ['create-npm-dirs','--cwd',directory])];
    const started=Date.now();
    const result=spawnSync(binary,args,{cwd:root,encoding:'utf8',timeout:5000,maxBuffer:128*1024,env:{...process.env,TMP:directory,TEMP:directory,TMPDIR:directory}});
    const logs={};
    for(const stream of ['stdout','stderr']) {
      const output=result[stream]||'';const file=path.join(directory,stream+'.log');fs.writeFileSync(file,output);
      logs[stream]={file:path.relative(root,file),bytes:Buffer.byteLength(output),sha256:crypto.createHash('sha256').update(output).digest('hex'),excerpt:output.slice(0,2048)};
    }
    const record={binary,args,operation,milliseconds:Date.now()-started,status:result.status,signal:result.signal,error:result.error&&{code:result.error.code,message:result.error.message},logs,
      generated:fs.existsSync(path.join(directory,'npm/win32-x64-msvc/package.json')),metadataFiles:fs.readdirSync(directory).filter(x=>x.startsWith('.napi-rs')).length};
    results.push(record); console.log(JSON.stringify({binary,operation,status:record.status,error:record.error?.code,generated:record.generated}));
  }
}
const report={date:new Date().toISOString(),command:'node scripts/distribution-review/diagnose-cli.cjs',host:process.versions,results};
fs.writeFileSync(path.join(base,'report.json'),JSON.stringify(report,null,2));console.log(path.relative(root,path.join(base,'report.json')));
