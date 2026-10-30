// Sanitized evidence is signed by a separately pinned acceptance collector key,
// never a key created/uploaded by a GitHub job. No raw JWT or signature is output.
import {hashJSON} from '../contract.mjs';
import {TrustError} from './oidc.mjs';
const need=(v,c)=>{if(!v)throw new TrustError(c);};
export function evidenceSigner({privateKey,publicKeyId}){
 need(privateKey?.type==='private'&&typeof publicKeyId==='string'&&publicKeyId.length>0,'EVIDENCE_SIGNER');
 return async record=>{const digest=hashJSON(record),signature=await crypto.subtle.sign('Ed25519',privateKey,new TextEncoder().encode(digest));return {record,digest,keyId:publicKeyId,signature:Buffer.from(signature).toString('base64url')};};
}
export async function verifyEvidence(envelope,{publicKey,keyId}){
 need(envelope?.keyId===keyId&&hashJSON(envelope.record)===envelope.digest&&await crypto.subtle.verify('Ed25519',publicKey,Buffer.from(envelope.signature,'base64url'),new TextEncoder().encode(envelope.digest)),'EVIDENCE_INTEGRITY');return envelope.record;
}
