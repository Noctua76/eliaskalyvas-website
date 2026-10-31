// Offline verification of an externally captured/signed audit. No credential,
// capture, signer generation or approval. Prints metadata only to private stdout.
import {privateFile} from './owner-source.mjs';
import {authenticatedApplicationInventory} from '../../lib/publication/runtime/application-inventory.mjs';
import {assessApplications} from '../../lib/publication/runtime/administration-evidence.mjs';
import {hashJSON} from '../../lib/publication/contract.mjs';
export async function inventoryReport({readSignedAudit,publicKey,keyId,now}){
 const read=authenticatedApplicationInventory({readSignedAudit,publicKey,keyId,now}),inventory=await read(),assessment=assessApplications(inventory);
 return {acceptedApplicationsSHA256:hashJSON(assessment.apps),integrationEvidence:inventory.integrationEvidence,ownerAuthorization:false};
}
if(process.argv[1]===new URL(import.meta.url).pathname){try{
 const config=await privateFile(process.argv[2]),pin=await privateFile(config.auditKeyFile);if(pin.keyId!==config.auditKeyId||hashJSON(pin.publicKey)!==config.auditPublicKeySHA256)throw Error('PIN');
 const publicKey=await crypto.subtle.importKey('jwk',pin.publicKey,'Ed25519',false,['verify']);console.log(JSON.stringify(await inventoryReport({readSignedAudit:()=>privateFile(config.applicationAuditFile),publicKey,keyId:pin.keyId})));
}catch{console.error('NYRA_APP_INVENTORY_NOT_VERIFIED');process.exitCode=1;}}
