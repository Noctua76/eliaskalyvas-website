// Focused native diagnostic. No DB, Auth, Storage, deployment or paid API stage.
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {readFile,writeFile,mkdir,cp,rm,mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {stageEdgeRuntime} from '../../runtime/nyra-edge/stage.mjs';
assert(process.env.GITHUB_ACTIONS==='true'&&process.env.RUNNER_ENVIRONMENT==='github-hosted');
const cmd=(name,args,options={})=>execFileSync(name,args,{encoding:'utf8',timeout:120000,stdio:['ignore','pipe','pipe'],...options});
const images=JSON.parse(await readFile(new URL('images.lock.json',import.meta.url))),root=await mkdtemp(join(tmpdir(),'nyra-edge-diagnostic-')),out=resolve('native-results');await mkdir(out,{recursive:true});
const names=['shared','release','manifest','event','receipt','dataset'],expected={};for(const n of names){const b=await readFile('contracts/nyra-publication/v1.1/'+n+'.schema.json');expected[n]=createHash('sha256').update(b).digest('hex');}
const project='nyra-edge-'+process.env.GITHUB_RUN_ID+'-'+process.env.GITHUB_RUN_ATTEMPT,network=project+'-isolated',container=project+'-edge';
const result={source:cmd('git',['rev-parse','HEAD']).trim(),expected,variants:[]};
for(const key of ['edge','probe'])cmd('docker',['pull',images[key].image]);
const stage=await stageEdgeRuntime();
try{
 const template=await readFile('ops/native-acceptance/edge-probe.ts','utf8');
 for(const name of ['raw-npm','raw-sync','raw-async','bundle-sync','bundle-async','missing-sync','altered-sync']){
  const dir=join(root,name);await cp(stage.dir,dir,{recursive:true});
  // Raw source remains byte-for-byte staged; only an explicit offline dependency
  // transport is selected for the vendored variants, using root-lockfile packages.
  if(name!=='raw-npm'){
   for(const dependency of ['ajv','fast-deep-equal','fast-uri','json-schema-traverse','require-from-string','parse5','entities'])await cp('node_modules/'+dependency,join(dir,'node_modules',dependency),{recursive:true});
   await writeFile(join(dir,'deno.json'),JSON.stringify({nodeModulesDir:'manual',imports:{'ajv/dist/2020.js':'./node_modules/ajv/dist/2020.js','parse5':'./node_modules/parse5/dist/index.js'}}));
  }
  const entry=template.replace('__SCHEMA_REL__','./contracts/nyra-publication/v1.1/');
  await writeFile(join(dir,'native-entry.ts'),entry);
  if(name.startsWith('bundle')){
   await build({entryPoints:[join(dir,'native-entry.ts')],outfile:join(dir,'lib/publication/probe-bundle.mjs'),bundle:true,platform:'node',format:'esm',packages:'bundle',external:['node:*'],banner:{js:'import {createRequire as nativeCreateRequire} from "node:module"; const require=nativeCreateRequire(import.meta.url);'}});
   // Keep real module ancestry of the inlined contract; FS probe URL is adjusted
   // only for the test reporter, never for the unchanged contract implementation.
   let bytes=await readFile(join(dir,'lib/publication/probe-bundle.mjs'),'utf8');bytes=bytes.replace('new URL("./contracts/nyra-publication/v1.1/"','new URL("../../contracts/nyra-publication/v1.1/"');await writeFile(join(dir,'lib/publication/probe-bundle.mjs'),bytes);
   await writeFile(join(dir,'native-entry.ts'),"import './lib/publication/probe-bundle.mjs';\n");
  }
  if(name==='missing-sync')await rm(join(dir,'contracts/nyra-publication/v1.1/shared.schema.json'));
  if(name==='altered-sync')await writeFile(join(dir,'contracts/nyra-publication/v1.1/shared.schema.json'),(await readFile(join(dir,'contracts/nyra-publication/v1.1/shared.schema.json'),'utf8'))+'\n');
 }
 await mkdir(join(root,'gateway'));await cp('ops/native-acceptance/edge-gateway.ts',join(root,'gateway/index.ts'));
 cmd('docker',['network','create','--internal',network]);const n=JSON.parse(cmd('docker',['network','inspect',network]))[0];assert(n.Internal);const bridge='br-'+n.Id.slice(0,12);
 cmd('sudo',['iptables','-I','INPUT','1','-i',bridge,'-m','conntrack','--ctstate','NEW','-j','DROP']);cmd('sudo',['iptables','-I','DOCKER-USER','1','-i',bridge,'!','-o',bridge,'-j','DROP']);
 for(const target of ['http://169.254.169.254','https://1.1.1.1'])assert.throws(()=>cmd('docker',['run','--rm','--network',network,images.probe.image,'-fsS','--max-time','3',target],{timeout:10000}));
 cmd('docker',['run','-d','--name',container,'--network',network,'--network-alias','edge','--security-opt','no-new-privileges:true','-v',root+':/native:ro','--workdir','/native','-e','DENO_DIR=/tmp/deno',images.edge.image,'start','--main-service','/native/gateway']);
 for(const name of ['raw-npm','raw-sync','raw-async','bundle-sync','bundle-async','missing-sync','altered-sync']){
  let value;try{const text=cmd('docker',['run','--rm','--network',network,images.probe.image,'-sS','--retry','8','--retry-connrefused','--retry-delay','1','--max-time','45','http://edge:9000/'+name+'/_diagnostic'],{timeout:55000});value=JSON.parse(text);}catch(e){value={transportError:e.message.slice(0,200)};}
  result.variants.push({name,...value});console.log(JSON.stringify({name,...value}));
 }
}finally{
 try{const log=spawnSync('docker',['logs',container],{encoding:'utf8'});await writeFile(join(out,'edge-focused.log'),log.stdout+log.stderr);}catch{}
 try{cmd('docker',['rm','-f',container]);}catch{}
 try{const n=JSON.parse(cmd('docker',['network','inspect',network]))[0],b='br-'+n.Id.slice(0,12);cmd('sudo',['iptables','-D','INPUT','-i',b,'-m','conntrack','--ctstate','NEW','-j','DROP']);cmd('sudo',['iptables','-D','DOCKER-USER','-i',b,'!','-o',b,'-j','DROP']);cmd('docker',['network','rm',network]);}catch{}
 await writeFile(join(out,'edge-diagnostic.json'),JSON.stringify(result,null,2));await rm(stage.root,{recursive:true,force:true});await rm(root,{recursive:true,force:true});
}
