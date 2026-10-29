import {readFile,writeFile,mkdir,cp,rename,rm} from 'node:fs/promises';
import {join} from 'node:path';
import sharp from 'sharp';
import {createHash} from 'node:crypto';
import {stageEdgeRuntime} from '../../runtime/nyra-edge/stage.mjs';
export async function prepare(root){
 const raw=await stageEdgeRuntime({offlineDependencies:true});
 try{
  await cp(raw.dir,join(root,'guarded'),{recursive:true});await rename(join(root,'guarded/index.ts'),join(root,'guarded/factory.ts'));
  for(const [name,source]of [['gateway','gateway.ts'],['events','events.ts'],['sharp','sharp.ts'],['guarded','guarded.ts'],...['healthy','memory','cpu','wall','deadline','concurrent','crash','network'].map(x=>[x,'worker.ts'])]){
   await mkdir(join(root,name),{recursive:true});await cp(new URL(source,import.meta.url),join(root,name,'index.ts'));
  }
  // Exact native packages from root npm-ci lock; include actual linux N-API and
  // libvips binaries. A dependency-absence error must not masquerade as Edge proof.
  for(const name of ['sharp','@img','detect-libc','semver'])await cp('node_modules/'+name,join(root,'sharp/node_modules',name),{recursive:true});
  await writeFile(join(root,'sharp/deno.json'),JSON.stringify({nodeModulesDir:'manual'}));
  const fixtures=[];for(const name of ['png','jpeg','webp']){const bytes=await sharp({create:{width:1200,height:630,channels:3,background:'#345678'}})[name]().toBuffer();fixtures.push({name,sha256:createHash('sha256').update(bytes).digest('hex'),base64:bytes.toString('base64')});}
  await writeFile(join(root,'sharp/fixtures.json'),JSON.stringify(fixtures));
  const inventory=[];for(const path of ['node_modules/sharp/package.json','node_modules/@img/sharp-linux-x64/lib/sharp-linux-x64.node','node_modules/@img/sharp-libvips-linux-x64/lib/libvips-cpp.so.8.17.3']){const b=await readFile(join(root,'sharp',path));inventory.push({path,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')});}
  await writeFile(join(root,'sharp/byte-inventory.json'),JSON.stringify(inventory));
  return {sharpVersion:JSON.parse(await readFile('node_modules/sharp/package.json','utf8')).version,fixtureFormats:fixtures.map(x=>x.name)};
 }finally{await rm(raw.root,{recursive:true,force:true});}
}
