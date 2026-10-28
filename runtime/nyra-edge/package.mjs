// Packaging entry only: NO Deno.serve, Supabase client, env read or route mount.
import {Buffer} from 'node:buffer';
if(typeof globalThis.Buffer==='undefined')globalThis.Buffer=Buffer;
export async function loadPrivateRuntime(){
 const [contract,authority,oidc,machine,assets,adapters,controller,artifact,githubJobs]=await Promise.all([
  import('../../lib/publication/contract.mjs'),import('../../lib/publication/authority.mjs'),
  import('../../lib/publication/runtime/oidc.mjs'),import('../../lib/publication/runtime/machine.mjs'),
  import('../../lib/publication/runtime/assets.mjs'),import('../../lib/publication/runtime/adapters.mjs'),import('../../lib/publication/runtime/controller.mjs'),import('../../lib/publication/runtime/artifact.mjs'),import('../../lib/publication/runtime/github-jobs.mjs')
 ]);
 return {contract,authority,oidc,machine,assets,adapters,controller,artifact,githubJobs};
}
