// Acceptance-only owner decision authority. No listener, production DB credential,
// editorial operation or provider call. Bind these trusted pins outside workflows.
import {randomUUID} from 'node:crypto';
import {hashJSON} from '../contract.mjs';
import {verifyEvidence} from './acceptance-evidence.mjs';
import {REPOSITORY} from './administration-evidence.mjs';
const need=(v,c)=>{if(!v)throw Error(c);};
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
// The existing hosted nyra-api/status gate performs website_owners + AAL2 checks
// with its existing private DB identity. The host receives NO service-role key.
// A NEW explicitly authorized owner session is presented over private transport.
export function existingOwnerMFA({projectOrigin,statusURL,ownerOrigin,ownerAuthUserId,publicApiKey,fetcher=fetch,now=Date.now}){
 const project=new URL(projectOrigin),status=new URL(statusURL);
 need(project.protocol==='https:'&&project.origin===projectOrigin&&project.pathname==='/'&&status.origin===projectOrigin&&status.pathname==='/functions/v1/nyra-api/status'&&!status.search&&!status.hash&&!status.username&&uuid(ownerAuthUserId)&&typeof publicApiKey==='string'&&publicApiKey.length>0,'OWNER_SOURCE_CONFIG');
 need(new URL(ownerOrigin).origin===ownerOrigin&&ownerOrigin.startsWith('https://'),'OWNER_SOURCE_CONFIG');
 return async token=>{
  try{
   need(typeof token==='string'&&token.length<20000,'OWNER_SESSION');
   const headers={Authorization:'Bearer '+token,apikey:publicApiKey,Origin:ownerOrigin};
   const options={method:'GET',redirect:'error',headers,signal:AbortSignal.timeout(10000)};
   const u=await fetcher(projectOrigin+'/auth/v1/user',options);need(u.ok,'OWNER_SESSION');const user=await u.json();
   need(user.id===ownerAuthUserId&&user.is_anonymous===false,'OWNER_IDENTITY');
   // Decode only after server-side verification of this exact bearer.
   const c=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());
   need(c.sub===ownerAuthUserId&&c.aal==='aal2'&&uuid(c.session_id)&&Number.isSafeInteger(c.exp)&&c.exp*1000>now(),'OWNER_MFA');
   const r=await fetcher(statusURL,{...options,signal:AbortSignal.timeout(10000)});need(r.ok,'OWNER_GATE');const state=await r.json();need(state.publishing===false,'OWNER_GATE');
   return {contract:'existing-owner-mfa',ownerId:'217035723',authUserId:ownerAuthUserId,sessionDigest:hashJSON(c.session_id),expiresAt:c.exp*1000};
  }catch{throw Error('OWNER_MFA_UNVERIFIED');}
 };
}
const context=(p,d)=>need(d.repository===REPOSITORY&&d.repositoryId==='1389733212'&&d.ownerId==='217035723'&&d.governanceMode==='SINGLE_OWNER'&&d.policyVersion===p.policyVersion&&d.applicationsSHA256===p.applicationsSHA256,'OWNER_DECISION_CONTEXT');
// journal is a durable private, signed append-only source, not request JSON.
// The independent administration/App audit must already be accepted in `policy`.
export function createOwnerRiskSource({policy,authenticateOwner,journal,signReceipt,now=Date.now}){
 need(policy?.repository===REPOSITORY&&policy.repositoryId==='1389733212'&&policy.ownerId==='217035723'&&policy.governanceMode==='SINGLE_OWNER'&&Number.isSafeInteger(policy.policyVersion)&&policy.policyVersion>0&&/^[a-f0-9]{64}$/.test(policy.applicationsSHA256)&&uuid(policy.ownerAuthUserId)&&Number.isFinite(Date.parse(policy.windowEndsAt)),'OWNER_SOURCE_POLICY');
 need(typeof authenticateOwner==='function'&&typeof journal?.append==='function'&&typeof journal?.current==='function'&&typeof signReceipt==='function','OWNER_SOURCE_DEPENDENCY');
 policy=structuredClone(policy);const sessions=new Map();let closed=false;
 const active=()=>need(!closed&&Date.parse(policy.windowEndsAt)>now(),'OWNER_WINDOW_EXPIRED');
 const authenticate=async token=>{active();const a=await authenticateOwner(token);active();need(a?.contract==='existing-owner-mfa'&&a.ownerId===policy.ownerId&&a.authUserId===policy.ownerAuthUserId&&/^[a-f0-9]{64}$/.test(a.sessionDigest)&&a.expiresAt>now(),'OWNER_AUTHORIZATION');return a;};
 return Object.freeze({
  async authorize({token,applicationsSHA256,policyVersion,riskAcknowledgment}){
   const a=await authenticate(token);need(applicationsSHA256===policy.applicationsSHA256&&policyVersion===policy.policyVersion&&riskAcknowledgment?.write===true&&riskAcknowledgment?.merge===true&&riskAcknowledgment?.workflow===true&&Object.keys(riskAcknowledgment).length===3,'OWNER_RISK_ACKNOWLEDGMENT');
   const ends=Math.min(a.expiresAt,Date.parse(policy.windowEndsAt),now()+900000);need(ends>now(),'OWNER_WINDOW_EXPIRED');
   const decision={schema:'nyra.owner-risk-decision.v1',decisionId:randomUUID(),repository:policy.repository,repositoryId:policy.repositoryId,ownerId:policy.ownerId,governanceMode:policy.governanceMode,policyVersion,applicationsSHA256,riskAcknowledgment:{...riskAcknowledgment},ownerAuthorization:{contract:a.contract,ownerId:a.ownerId,verified:true,evidenceId:randomUUID(),sessionDigest:a.sessionDigest},state:'active',supersededBy:null,issuedAt:new Date(now()).toISOString(),expiresAt:new Date(ends).toISOString()};
   active();await journal.append(decision);sessions.clear();sessions.set(decision.decisionId,token);return {decisionId:decision.decisionId,expiresAt:decision.expiresAt,applicationsSHA256};
  },
  async retire({token,decisionId}){
   await authenticate(token);const d=await journal.current();need(d?.decisionId===decisionId&&d.state==='active','OWNER_DECISION_INACTIVE');
   await journal.append({...d,state:'retired',retiredAt:new Date(now()).toISOString()});sessions.delete(decisionId);return {retired:true,decisionId};
  },
  async receipt({decisionId,challenge}){
   active();need(uuid(challenge),'OWNER_CHALLENGE');const d=await journal.current();context(policy,d??{});
   need(d?.decisionId===decisionId&&d.state==='active'&&d.supersededBy===null&&Date.parse(d.expiresAt)>now(),'OWNER_DECISION_INACTIVE');
   const a=await authenticate(sessions.get(decisionId));need(a.sessionDigest===d.ownerAuthorization.sessionDigest,'OWNER_SESSION_SUBSTITUTED');
   // Check current state AGAIN after remote authentication; retirement wins.
   need(hashJSON(await journal.current())===hashJSON(d),'OWNER_DECISION_CHANGED');
   const expires=Math.min(now()+45000,Date.parse(d.expiresAt),a.expiresAt,Date.parse(policy.windowEndsAt));need(expires>now(),'OWNER_WINDOW_EXPIRED');
   active();const receipt=await signReceipt({...d,schema:'nyra.owner-risk-decision.receipt.v1',challenge,issuedAt:new Date(now()).toISOString(),expiresAt:new Date(expires).toISOString()});
   active();need(hashJSON(await journal.current())===hashJSON(d)&&expires>now(),'OWNER_DECISION_CHANGED');return receipt;
  },
  close(){closed=true;sessions.clear();}
 });
}
// `records` has private storage transport semantics. Every entry must be signed
// by the independently pinned source key, chained and monotonically sequenced.
export function signedDecisionJournal({records,signRecord,publicKey,keyId}){
 let queue=Promise.resolve();
 const read=async()=>{const rows=await records.read();need(Array.isArray(rows)&&rows.length<=1000,'OWNER_JOURNAL');let previous=null,current=null;
  for(let i=0;i<rows.length;i++){const r=await verifyEvidence(rows[i],{publicKey,keyId});need(r.schema==='nyra.owner-risk-journal.v1'&&r.sequence===i+1&&r.previousDigest===previous,'OWNER_JOURNAL_CHAIN');previous=rows[i].digest;current=r.decision;}
  return {current,previous,sequence:rows.length};};
 return Object.freeze({async current(){return (await read()).current;},append(decision){const task=queue.then(async()=>{const r=await read();await records.append(await signRecord({schema:'nyra.owner-risk-journal.v1',sequence:r.sequence+1,previousDigest:r.previous,decision}));});queue=task.catch(()=>{});return task;}});
}
