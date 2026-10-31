// Explicit future protected CLI. No execution on import; no accepted config ships.
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {reviewedIntegrationPolicy} from '../../lib/publication/integration/policy.mjs';
import {privateInspectionClient,runPendingInspections} from '../../lib/publication/integration/inspection-client.mjs';
import {actionsToken} from '../../lib/publication/integration/runner.mjs';
export async function inspectPending({configuration,env=process.env,fetcher=fetch}){
 const p=reviewedIntegrationPolicy(configuration,'inspection');
 if(env.NYRA_INSPECTION_ENABLED!=='true'||env.GITHUB_REPOSITORY!==p.repository||env.GITHUB_REF!==p.ref||env.GITHUB_SHA!==p.callerSHA||!p.events.includes(env.GITHUB_EVENT_NAME))throw Error('INSPECTION_DISABLED');
 const service=privateInspectionClient({endpoint:configuration.inspectionEndpoint,tokenSource:()=>actionsToken(p.audience,{env,fetcher}),fetcher});return runPendingInspections({service});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{const configuration=JSON.parse(await readFile(new URL('../protected-delivery/accepted-configuration.json',import.meta.url)));const result=await inspectPending({configuration});console.log(JSON.stringify(result));if(result.status==='batch_limit')process.exitCode=1;}catch{console.error('PRIVATE_INSPECTION_BLOCKED_OR_UNKNOWN');process.exitCode=1;}}
