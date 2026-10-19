'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {execFileSync,spawnSync}=require('node:child_process');
const directory=__dirname,root=path.resolve(directory,'../..');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const manifest=read(path.join(directory,'candidate.json'));
const previousDirectory=path.join(root,'.verification/readiness-final-01');
const before=read(path.join(previousDirectory,'candidate.json'));
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
const out={date:new Date().toISOString(),status:'IN_PROGRESS',candidateSha256:manifest.sha256,measuredCandidateSha256:before.sha256,commands:[],examples:{}};
function run(node,args,cwd=root){const output=execFileSync(node,args,{cwd,encoding:'utf8',timeout:30000,maxBuffer:1024*1024});out.commands.push({command:[node,...args],cwd,status:'PASS',output});return output;}
try{
 const excluded=new Set(['package.json','README.md','docs/performance.md']);
 out.identicalRuntimeAndLicenseFiles=Object.keys(before.files).filter(f=>!excluded.has(f));
 for(const file of out.identicalRuntimeAndLicenseFiles)assert.deepEqual(manifest.files[file],before.files[file],file);
 assert.equal(out.identicalRuntimeAndLicenseFiles.length,11);
 const extract=(dir,file)=>execFileSync('tar',['-xzOf',path.join(dir,manifest.filename),'package/'+file],{maxBuffer:16*1024*1024});
 const oldPackage=JSON.parse(extract(previousDirectory,'package.json'));
 const newPackage=JSON.parse(extract(directory,'package.json'));
 for(const key of new Set([...Object.keys(oldPackage),...Object.keys(newPackage)])){
  if(!['description','files','scripts'].includes(key))assert.deepEqual(newPackage[key],oldPackage[key],key);
 }
 assert.deepEqual(newPackage.files.filter(file=>!oldPackage.files.includes(file)),['examples']);
 for(const file of oldPackage.files)assert.ok(newPackage.files.includes(file));
 for(const [name,command] of Object.entries(oldPackage.scripts))assert.equal(newPackage.scripts[name],command);
 assert.deepEqual(Object.keys(newPackage.scripts).filter(name=>!Object.hasOwn(oldPackage.scripts,name)),['bench:text']);
 out.metadataChanges=['description','files adds examples','scripts adds bench:text'];
 for(const file of ['basic.cjs','json-text.cjs','json-text.mjs','json-text.mts']){
  const relative='examples/'+file,bytes=extract(directory,relative);
  assert.deepEqual(bytes,fs.readFileSync(path.join(root,relative)));
  for(const manager of ['npm','pnpm'])assert.deepEqual(bytes,fs.readFileSync(path.join(directory,manager,'node_modules/stable-json-rs',relative)));
  out.examples[relative]={bytes:bytes.length,sha256:hash(bytes),packedInstalledSourceEqual:true};
 }
 const compilerPackage=require.resolve('typescript/package.json',{paths:[root]});
 const compiler=path.resolve(path.dirname(compilerPackage),read(compilerPackage).bin.tsc);
 for(const node of [process.execPath,path.join(root,'.tools/node-v22.13.0-win-x64/node.exe')]){
  const version=run(node,['--version']).trim();
  for(const manager of ['npm','pnpm']){
   const installed=path.join(directory,manager,'node_modules/stable-json-rs/examples');
   for(const file of ['basic.cjs','json-text.cjs','json-text.mjs'])run(node,[path.join(installed,file)]);
   const application=path.join(directory,manager,'typed-example.mts');
   fs.copyFileSync(path.join(installed,'json-text.mts'),application);
   assert.deepEqual(fs.readFileSync(application),fs.readFileSync(path.join(installed,'json-text.mts')));
   run(node,[...(version.startsWith('v22.')?['--experimental-strip-types']:[]),application]);
   run(node,[compiler,'--noEmit','--strict','--skipLibCheck','false','--target','ES2022','--module','NodeNext','--moduleResolution','NodeNext',application]);
  }
 }
 const args=[path.join(root,'scripts/verify-ci-candidate.cjs'),'verify',directory,'--all-targets'];
 const rejected=spawnSync(process.execPath,args,{encoding:'utf8',timeout:30000});
 assert.notEqual(rejected.status,0);assert.match(rejected.stderr,/combined candidate missing stable-json-rs\.linux-x64-gnu\.node/);
 out.combinedGate={status:'EXPECTED_REJECTION',command:[process.execPath,...args],exitCode:rejected.status,stderr:rejected.stderr,note:'Actual host-only tar; not combined-runtime verification.'};
 assert.equal(hash(fs.readFileSync(path.join(directory,manifest.filename))),manifest.sha256);
 out.status='PASS';
} catch(error){out.status='FAIL';out.error=error.stack;throw error;}
finally{fs.writeFileSync(path.join(directory,'packaged-examples-and-equivalence-v2.json'),JSON.stringify(out,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:out.status,commandCount:out.commands.length,examples:Object.keys(out.examples),identicalRuntimeAndLicenseFiles:out.identicalRuntimeAndLicenseFiles?.length}));}
