import {writeFile,mkdir,cp,rename,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {stageEdgeRuntime} from '../../runtime/nyra-edge/stage.mjs';
export async function prepare(root){
 const raw=await stageEdgeRuntime({offlineDependencies:true});
 try{
  await cp(raw.dir,join(root,'guarded'),{recursive:true});await rename(join(root,'guarded/index.ts'),join(root,'guarded/factory.ts'));
  for(const [name,source]of [['gateway','gateway.ts'],['events','events.ts'],['guarded','guarded.ts'],...['healthy','memory','cpu','wall','deadline','concurrent','crash','network'].map(x=>[x,'worker.ts'])]){
   await mkdir(join(root,name),{recursive:true});await cp(new URL(source,import.meta.url),join(root,name,'index.ts'));
  }
  return {sharpVersion:'unsupported-in-Edge; see accepted historical evidence',fixtureFormats:[]};

 }finally{await rm(raw.root,{recursive:true,force:true});}
}
