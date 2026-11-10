// Exact operation binding signed by the existing Owner Source, never a grant
// derived from a host's lifetime or an unsigned renewal-session file.
import {hashJSON} from '../contract.mjs';
import {verifyEvidence} from './acceptance-evidence.mjs';
import {signingKeySHA256} from './repository-policy.mjs';
const need=(v,c)=>{if(!v)throw Error('DB_RENEWAL_APPROVAL_'+c);};
export function validateRenewalBinding(b,{now=Date.now}={}){
 const fields=['bootstrapId','hostname','providerResourceId','targetSHA256','machineIdSHA256','sessionSHA256','sessionId','startsAt','endsAt'];
 need(b&&Object.keys(b).sort().join(',')===fields.sort().join(','),'FIELDS');
 need(/^nyra-acceptance-[a-z0-9-]{6,40}$/.test(b.bootstrapId)&&b.hostname===b.bootstrapId&&
  b.bootstrapId!=='nyra-acceptance-20261102-01'&&/^[1-9][0-9]{0,19}$/.test(b.providerResourceId)&&
  b.providerResourceId!=='615221104'&&['targetSHA256','machineIdSHA256','sessionSHA256'].every(k=>/^[a-f0-9]{64}$/.test(b[k]))&&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(b.sessionId),'IDENTITY');
 const utc=s=>typeof s==='string'&&Number.isFinite(Date.parse(s))&&
  [new Date(Date.parse(s)).toISOString(),new Date(Date.parse(s)).toISOString().replace('.000Z','Z')].includes(s);
 need(utc(b.startsAt)&&utc(b.endsAt)&&Date.parse(b.startsAt)<=now()&&now()<Date.parse(b.endsAt)&&
  Date.parse(b.endsAt)-Date.parse(b.startsAt)<=86400000,'WINDOW');
 return b;
}
export async function verifyRenewalApproval({envelope,binding,ownerPublicJWK,ownerKeyId,expectedKeySHA256,ownerDecisionId,now=Date.now}){
 validateRenewalBinding(binding,{now});
 need(signingKeySHA256(ownerPublicJWK)===expectedKeySHA256,'KEY_PIN');
 const key=await crypto.subtle.importKey('jwk',ownerPublicJWK,'Ed25519',false,['verify']);
 const r=await verifyEvidence(envelope,{publicKey:key,keyId:ownerKeyId});
 need(r.schema==='nyra.acceptance.db-renewal-approval.v1'&&r.repository==='Noctua76/eliaskalyvas-website'&&
  r.ownerId==='217035723'&&r.governanceMode==='SINGLE_OWNER'&&r.ownerDecisionId===ownerDecisionId&&
  hashJSON(r.binding)===hashJSON(binding),'BINDING');
 const issued=Date.parse(r.issuedAt),expires=Date.parse(r.expiresAt);
 need(Number.isFinite(issued)&&Number.isFinite(expires)&&issued<=now()&&now()<expires&&
  expires-issued>0&&expires-issued<=60000&&expires<=Date.parse(binding.endsAt),'FRESHNESS');
 return r;
}
