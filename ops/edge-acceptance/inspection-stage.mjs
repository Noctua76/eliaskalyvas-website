import {stageEdgeRuntime} from '../../runtime/nyra-edge/stage.mjs';
import {cp,writeFile,mkdir,rm} from 'node:fs/promises';
import {join,dirname,resolve} from 'node:path';
import {build} from 'esbuild';
export async function prepareInspectionEdge(root){
 const stage=await stageEdgeRuntime({offlineDependencies:true});
 try{
  await cp(stage.dir,join(root,'inspection'),{recursive:true});
  const target=join(root,'inspection/lib/publication/inspection-edge.mjs');await mkdir(dirname(target),{recursive:true});
  await build({entryPoints:[resolve('ops/edge-acceptance/inspection-edge.mjs')],outfile:target,bundle:true,platform:'node',format:'esm',packages:'bundle',external:['node:*'],banner:{js:'import {createRequire as nativeCreateRequire} from "node:module"; const require=nativeCreateRequire(import.meta.url);'}});
  await writeFile(join(root,'inspection/index.ts'),"import './lib/publication/inspection-edge.mjs';\n");
  await mkdir(join(root,'gateway'),{recursive:true});
  await writeFile(join(root,'gateway/index.ts'),`const c=Deno.env.get('NYRA_INSPECTION_TEST_CONFIG');Deno.serve(async req=>{if(new URL(req.url).pathname==='/_health')return new Response('ready');try{const w=await EdgeRuntime.userWorkers.create({servicePath:'/native/inspection',memoryLimitMb:256,workerTimeoutMs:120000,cpuTimeSoftLimitMs:1500,cpuTimeHardLimitMs:2000,noModuleCache:false,forceCreate:false,envVars:[['NYRA_INSPECTION_TEST_CONFIG',c]],staticPatterns:['/native/inspection/contracts/**/*.json'],context:{useReadSyncFileAPI:true}});return await w.fetch(req);}catch{return Response.json({error:'NATIVE_WORKER_UNAVAILABLE'},{status:503});}});`);
  return {expected:{},root};
 }finally{await rm(stage.root,{recursive:true,force:true});}
}
