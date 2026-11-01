// Explicit offline staging command, never run on import or by a workflow.
// Copies a static import closure + schema assets, and ONLY the dedicated locked
// pg/AJV/parse5 dependency tree. No fixture, build toolchain or credential copy.
import {readFile,writeFile,mkdir,copyFile,cp,lstat,realpath} from 'node:fs/promises';
import {dirname,resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
const roots=['ops/acceptance-bootstrap/repository-db.mjs','ops/acceptance-bootstrap/repository-launch.mjs','ops/acceptance-bootstrap/repository-runtime.mjs','ops/acceptance-bootstrap/replacement-target.mjs','ops/acceptance-bootstrap/live-role-worker.mjs','ops/acceptance-bootstrap/fra1-runtime.mjs','ops/acceptance-bootstrap/fra1-launch.mjs'];
export async function stageLiveRuntime({source,destination}){
 source=await realpath(source);destination=resolve(destination);if(destination===source||destination.startsWith(source+'/'))throw Error('STAGE_OUTSIDE_CHECKOUT');
 await mkdir(destination,{mode:0o755});const seen=new Set();
 const copy=async path=>{if(seen.has(path))return;seen.add(path);const src=join(source,path);if(await realpath(src)!==src||!(await lstat(src)).isFile())throw Error('STAGE_SOURCE');const text=await readFile(src,'utf8');await mkdir(dirname(join(destination,path)),{recursive:true});await copyFile(src,join(destination,path));
  for(const m of text.matchAll(/^(?:import|export)[^;\n]*?from\s*['"]([^'"]+)['"]/gm)){if(m[1].startsWith('.')){const full=resolve(dirname(src),m[1]);if(!full.startsWith(source+'/'))throw Error('STAGE_SCOPE');await copy(full.slice(source.length+1));}}
 };
 for(const r of roots)await copy(r);
 for(const name of ['shared','release','manifest','event','receipt','dataset']){const p='contracts/nyra-publication/v1.1/'+name+'.schema.json';await mkdir(dirname(join(destination,p)),{recursive:true});await copyFile(join(source,p),join(destination,p));seen.add(p);}
 const p=JSON.parse(await readFile(join(source,'ops/acceptance-bootstrap/runtime/package.json'),'utf8'));if(JSON.stringify(p.dependencies)!==JSON.stringify({ajv:'8.17.1',parse5:'8.0.1',pg:'8.16.3'}))throw Error('RUNTIME_DEPENDENCIES');
 await cp(join(source,'ops/acceptance-bootstrap/runtime/node_modules'),join(destination,'node_modules'),{recursive:true,dereference:false});
 await writeFile(join(destination,'runtime-files.json'),JSON.stringify([...seen].sort()));return {files:seen.size,dependencies:p.dependencies,credentialsCopied:false,fixturesCopied:false};
}
if(process.argv[1]===new URL(import.meta.url).pathname){try{if(process.argv[2]!=='--stage')throw Error('MODE');console.log(JSON.stringify(await stageLiveRuntime({source:process.argv[3],destination:process.argv[4]})));}catch{console.error('NYRA_LIVE_STAGE_DENIED');process.exitCode=1;}}
