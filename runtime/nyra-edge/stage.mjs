// Prepare an isolated, self-contained Supabase CLI function project. No deploy.
import {mkdtemp,mkdir,readFile,writeFile,copyFile,cp} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {tmpdir} from 'node:os';
import {verifySchemaAssets} from './schema-assets.mjs';
import {privateRuntimeFiles} from './package-layout.mjs';
export const integrationRuntimeFiles=Object.freeze([
 ...privateRuntimeFiles,
 ...['archive','observer','github','dispatch','service','outbox'].map(n=>'lib/publication/integration/'+n+'.mjs'),
 'lib/signals/seo.mjs','src/signals/public-view.mjs','src/signals/model.mjs','src/signals/entries.mjs','src/signals/data.mjs',
 'runtime/nyra-edge/integration.mjs','runtime/nyra-edge/schema-assets.mjs',
 'lib/publication/integration/policy.mjs','lib/publication/runtime/delivery-policy.mjs',
 'runtime/nyra-edge/repository-binding.mjs','lib/publication/runtime/repository-policy.mjs','lib/publication/runtime/repository-trust.mjs','lib/publication/runtime/administration-evidence.mjs','lib/publication/runtime/acceptance-evidence.mjs',
 'runtime/nyra-edge/editorial.mjs','runtime/nyra-edge/application.mjs','runtime/nyra-edge/final-delivery.mjs','lib/publication/runtime/inspection.mjs'
]);
export async function stageEdgeRuntime({offlineDependencies=false}={}){
 verifySchemaAssets();
 const source=resolve(import.meta.dirname,'../..'),root=await mkdtemp(join(tmpdir(),'nyra-edge-stage-')),dir=join(root,'supabase/functions/nyra-delivery');
 for(const path of integrationRuntimeFiles){const target=join(dir,path);await mkdir(dirname(target),{recursive:true});await copyFile(join(source,path),target);}
 const config={nodeModulesDir:'auto',imports:{'ajv/dist/2020.js':'npm:ajv@8.17.1/dist/2020.js','parse5':'npm:parse5@8.0.1'}};
 if(offlineDependencies){
  // Offline, unbundled transport from npm-ci's lockfile dependencies.
  for(const [name,version]of Object.entries({ajv:'8.17.1',parse5:'8.0.1'})){
   const pkg=JSON.parse(await readFile(join(source,'node_modules',name,'package.json'),'utf8'));
   if(pkg.version!==version)throw Error('EDGE_DEPENDENCY_VERSION:'+name);
  }
  for(const name of ['ajv','fast-deep-equal','fast-uri','json-schema-traverse','require-from-string','parse5','entities'])await cp(join(source,'node_modules',name),join(dir,'node_modules',name),{recursive:true});
  config.nodeModulesDir='manual';config.imports={'ajv/dist/2020.js':'./node_modules/ajv/dist/2020.js','parse5':'./node_modules/parse5/dist/index.js'};
 }
 await writeFile(join(dir,'deno.json'),JSON.stringify(config,null,2));
 // Importable handler factory only. No Deno.serve, env read or enabled listener.
 await writeFile(join(dir,'index.ts'),"import {verifySchemaAssets} from './runtime/nyra-edge/schema-assets.mjs';\nverifySchemaAssets();\nconst {composePrivateDelivery}=await import('./runtime/nyra-edge/integration.mjs');\nconst {createFinalEditorialApplication}=await import('./runtime/nyra-edge/application.mjs');\nconst {composeFinalDelivery}=await import('./runtime/nyra-edge/final-delivery.mjs');\nconst {bindRepositoryControlPlane}=await import('./runtime/nyra-edge/repository-binding.mjs');\nexport {composePrivateDelivery,createFinalEditorialApplication,composeFinalDelivery,bindRepositoryControlPlane};\n");
 const schemas=integrationRuntimeFiles.filter(p=>p.endsWith('.schema.json')).map(p=>'"./functions/nyra-delivery/'+p+'"').join(',');
 await writeFile(join(root,'supabase/config.toml'),'project_id = "nyra-disposable-acceptance"\n[functions.nyra-delivery]\nverify_jwt = false\nentrypoint = "./functions/nyra-delivery/index.ts"\nimport_map = "./functions/nyra-delivery/deno.json"\nstatic_files = ['+schemas+']\n');
 return {root,dir,files:integrationRuntimeFiles};
}
