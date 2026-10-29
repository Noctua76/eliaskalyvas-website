// Test-only packaging: stage the actual raw project before deriving an independent
// esbuild variant. No application/schema rewrites and no compile-directory mounts.
import {readFile,writeFile,mkdir,cp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {build} from 'esbuild';
import {stageEdgeRuntime} from '../../runtime/nyra-edge/stage.mjs';
import {schemaAssetSHA256} from '../../runtime/nyra-edge/schema-assets.mjs';
export const edgeVariants=['raw','bundled',...Object.keys(schemaAssetSHA256).flatMap(n=>['missing-'+n,'altered-'+n]),'bundle-missing-shared','bundle-altered-shared'];
export async function prepareEdgeAcceptance(root){
 const stage=await stageEdgeRuntime({offlineDependencies:true});
 try{
  const template=await readFile(new URL('edge-entry.mjs',import.meta.url),'utf8');
  for(const name of edgeVariants){
   const dir=join(root,name);await cp(stage.dir,dir,{recursive:true});
   const bundled=name.startsWith('bundle');
   const entry=template.replace('__SCHEMA_REL__',bundled?'../../contracts/nyra-publication/v1.1/':'./contracts/nyra-publication/v1.1/');
   await writeFile(join(dir,'native-entry.ts'),entry);
   if(bundled){
    await build({entryPoints:[join(dir,'native-entry.ts')],outfile:join(dir,'lib/publication/probe-bundle.mjs'),bundle:true,platform:'node',format:'esm',packages:'bundle',external:['node:*'],banner:{js:'import {createRequire as nativeCreateRequire} from "node:module"; const require=nativeCreateRequire(import.meta.url);'}});
    await writeFile(join(dir,'native-entry.ts'),"import './lib/publication/probe-bundle.mjs';\n");
   }
   const match=name.match(/(?:^|bundle-)(missing|altered)-(\w+)$/);
   if(match){const path=join(dir,'contracts/nyra-publication/v1.1/'+match[2]+'.schema.json');if(match[1]==='missing')await rm(path);else await writeFile(path,(await readFile(path,'utf8'))+'\n');}
  }
  await mkdir(join(root,'gateway'),{recursive:true});
  await cp(new URL('edge-gateway.ts',import.meta.url),join(root,'gateway/index.ts'));
  return {variants:edgeVariants,expected:schemaAssetSHA256};
 }finally{await rm(stage.root,{recursive:true,force:true});}
}
