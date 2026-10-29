import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,rm,mkdtemp} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {schemaAssetSHA256,verifySchemaAssets} from '../runtime/nyra-edge/schema-assets.mjs';
import {stageEdgeRuntime} from '../runtime/nyra-edge/stage.mjs';
import {prepareEdgeAcceptance} from '../ops/native-acceptance/edge-package.mjs';

test('Edge package pins all six exact v1.1 schema byte hashes without changing the Node loader',async()=>{
 verifySchemaAssets();assert.equal(Object.keys(schemaAssetSHA256).length,6);
 for(const [name,expected]of Object.entries(schemaAssetSHA256)){
  const bytes=await readFile(new URL('../contracts/nyra-publication/v1.1/'+name+'.schema.json',import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),expected);
 }
});
test('raw offline stage preserves every original source and guards before importing the handler',async()=>{
 const stage=await stageEdgeRuntime({offlineDependencies:true});
 try{
  for(const path of stage.files)assert.deepEqual(await readFile(stage.dir+'/'+path),await readFile(new URL('../'+path,import.meta.url)));
  const config=JSON.parse(await readFile(stage.dir+'/deno.json','utf8'));assert.equal(config.nodeModulesDir,'manual');assert(config.imports['ajv/dist/2020.js'].startsWith('./node_modules/'));
  const entry=await readFile(stage.dir+'/index.ts','utf8');assert(entry.indexOf('verifySchemaAssets();')<entry.indexOf('await import('));assert(!entry.includes('Deno.serve'));assert(!entry.includes('env.get'));
  const guard=await import(pathToFileURL(stage.dir+'/runtime/nyra-edge/schema-assets.mjs'));guard.verifySchemaAssets();
 }finally{await rm(stage.root,{recursive:true,force:true});}
});
for(const name of Object.keys(schemaAssetSHA256))for(const mode of ['missing','altered'])test('Edge package fails closed on '+mode+' '+name+' bytes',async()=>{
 const stage=await stageEdgeRuntime();
 try{
  const guard=await import(pathToFileURL(stage.dir+'/runtime/nyra-edge/schema-assets.mjs'));
  const path=stage.dir+'/contracts/nyra-publication/v1.1/'+name+'.schema.json';
  if(mode==='missing')await rm(path);else await writeFile(path,(await readFile(path,'utf8'))+'\n');
  assert.throws(()=>guard.verifySchemaAssets(),mode==='missing'?/ENOENT/:new RegExp('EDGE_SCHEMA_INTEGRITY:'+name));
 }finally{await rm(stage.root,{recursive:true,force:true});}
});
test('native raw-stage acceptance input is independent from esbuild and has no compile-directory filesystem mount',async()=>{
 const root=await mkdtemp(join(tmpdir(),'nyra-edge-package-test-'));
 try{
  const prepared=await prepareEdgeAcceptance(root);assert.equal(prepared.variants.length,16);assert.deepEqual(prepared.expected,schemaAssetSHA256);
  assert(!String(await readFile(root+'/raw/native-entry.ts')).includes('probe-bundle'));
  assert(String(await readFile(root+'/bundled/native-entry.ts')).includes('probe-bundle'));
  for(const n of Object.keys(schemaAssetSHA256))assert.deepEqual(await readFile(root+'/raw/contracts/nyra-publication/v1.1/'+n+'.schema.json'),await readFile(root+'/bundled/contracts/nyra-publication/v1.1/'+n+'.schema.json'));
  const gateway=await readFile(root+'/gateway/index.ts','utf8');assert(gateway.includes('EdgeRuntime.userWorkers.create'));assert(gateway.includes('staticPatterns'));assert(!gateway.includes('sb-compile-edge-runtime'));assert(!gateway.includes('env.get'));
 }finally{await rm(root,{recursive:true,force:true});}
});
