// Server composition, not an entrypoint. No env reads, client, listener or flags
// are installed. The reviewed control plane supplies the live trust assertion.
import {composeEditorialPublication} from './editorial.mjs';
import {privateAssetStorage} from '../../lib/publication/runtime/adapters.mjs';
import {privateQuarantineStorage} from '../../lib/publication/runtime/inspection.mjs';
export function createFinalEditorialApplication({db,env,codeSHA,assertTrustReady,enabled=false,fetcher=fetch,sourceFetcher=fetch,now=Date.now}){
 if(enabled!==true)return composeEditorialPublication({db,env,enabled:false,fetcher,sourceFetcher,now});
 const accepted=env?.NYRA_PRIVATE_ASSET_BUCKET,quarantine=env?.NYRA_QUARANTINE_BUCKET;
 if(!/^[a-f0-9]{40}$/.test(codeSHA)||typeof assertTrustReady!=='function'||
  ![accepted,quarantine].every(x=>typeof x==='string'&&/^[a-z0-9][a-z0-9-]{2,62}$/.test(x))||accepted===quarantine)throw Error('FINAL_EDITORIAL_BINDING_REQUIRED');
 return composeEditorialPublication({db,env,codeSHA,assertTrustReady,enabled:true,fetcher,sourceFetcher,now,
  storage:privateAssetStorage(db,{bucket:accepted}),quarantine:privateQuarantineStorage(db,{bucket:quarantine})});
}
