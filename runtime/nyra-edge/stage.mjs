// Prepare an isolated, self-contained Supabase CLI function project. No deploy.
import {mkdtemp,mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {tmpdir} from 'node:os';
import {privateRuntimeFiles} from './package-layout.mjs';
export const integrationRuntimeFiles=Object.freeze([
 ...privateRuntimeFiles,
 ...['archive','observer','github','dispatch','service','outbox'].map(n=>'lib/publication/integration/'+n+'.mjs'),
 'lib/signals/seo.mjs','src/signals/public-view.mjs','src/signals/model.mjs','src/signals/entries.mjs','src/signals/data.mjs',
 'runtime/nyra-edge/integration.mjs'
]);
export async function stageEdgeRuntime(){
 const source=resolve(import.meta.dirname,'../..'),root=await mkdtemp(join(tmpdir(),'nyra-edge-stage-')),dir=join(root,'supabase/functions/nyra-delivery');
 for(const path of integrationRuntimeFiles){const target=join(dir,path);await mkdir(dirname(target),{recursive:true});await copyFile(join(source,path),target);}
 const config={nodeModulesDir:'auto',imports:{'ajv/dist/2020.js':'npm:ajv@8.17.1/dist/2020.js','parse5':'npm:parse5@8.0.1'}};
 await writeFile(join(dir,'deno.json'),JSON.stringify(config,null,2));
 // Importable handler factory only. No Deno.serve, env read or enabled listener.
 await writeFile(join(dir,'index.ts'),"export {composePrivateDelivery} from './runtime/nyra-edge/integration.mjs';\n");
 const schemas=integrationRuntimeFiles.filter(p=>p.endsWith('.schema.json')).map(p=>'"./functions/nyra-delivery/'+p+'"').join(',');
 await writeFile(join(root,'supabase/config.toml'),'project_id = "nyra-disposable-acceptance"\n[functions.nyra-delivery]\nverify_jwt = false\nentrypoint = "./functions/nyra-delivery/index.ts"\nimport_map = "./functions/nyra-delivery/deno.json"\nstatic_files = ['+schemas+']\n');
 return {root,dir,files:integrationRuntimeFiles};
}
