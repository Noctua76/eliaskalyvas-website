// Evidence reader, NOT an account-wide GitHub API claim. The signing identity
// belongs to the separately approved authenticated owner-audit capture source.
import {verifyEvidence} from './acceptance-evidence.mjs';
import {hashJSON} from '../contract.mjs';
const REPO='Noctua76/eliaskalyvas-website',ID='1389733212',OWNER='217035723';
const families=['installed-github-apps','authorized-github-apps','authorized-oauth-apps','personal-access-tokens','repository-integrations'];
const permissions=['contents','workflows','pull_requests','administration','actions','checks','deployments','environments'];
const need=(v,c)=>{if(!v)throw Error('APP_AUDIT_'+c);};
export function normalizeIntegrationAudit(r,{now=Date.now(),maxAge=300000}={}){
 need(r?.schema==='nyra.authenticated.integration-audit.v1'&&r.repository===REPO&&r.repositoryId===ID&&r.ownerId===OWNER,'IDENTITY');
 need(typeof r.auditId==='string'&&r.auditId.length>0&&r.complete===true&&Array.isArray(r.outstanding)&&r.outstanding.length===0,'INCOMPLETE');
 const time=Date.parse(r.observedAt);need(Number.isFinite(time)&&time<=now&&now-time<maxAge,'STALE');
 need(Array.isArray(r.coverage)&&r.coverage.length===families.length&&new Set(r.coverage.map(x=>x.family)).size===families.length,'COVERAGE');
 for(const f of families){const c=r.coverage.find(x=>x.family===f);need(c?.authenticatedOwnerId===OWNER&&c.complete===true&&c.paginationComplete===true&&c.method==='authenticated-owner-settings-export'&&/^https:\/\/github\.com\/settings\//.test(c.sourceURL)&&/^[a-f0-9]{64}$/.test(c.captureSHA256),'COVERAGE');}
 need(Array.isArray(r.integrations)&&r.integrations.length<1000&&new Set(r.integrations.map(x=>x.kind+':'+x.id)).size===r.integrations.length,'ENTITIES');
 const integrations=r.integrations.map(x=>{
  need(['github-app','oauth-app','personal-access-token','repository-integration'].includes(x.kind)&&typeof x.id==='string'&&x.id.length>0&&typeof x.name==='string'&&x.name.length>0,'ENTITY');
  need(Array.isArray(x.scopes)&&x.scopes.every(s=>typeof s==='string'&&s.length>0)&&x.permissions&&permissions.every(p=>['read','write','none'].includes(x.permissions[p]))&&Object.values(x.permissions).every(v=>['read','write','none'].includes(v)),'PERMISSIONS');
  const a=x.repositoryAccess;need(a&&['all','selected','none','public-read-only'].includes(a.mode)&&Array.isArray(a.repositoryIds)&&a.repositoryIds.every(v=>typeof v==='string'&&/^[1-9][0-9]*$/.test(v)),'ACCESS');
  need(typeof x.active==='boolean'&&typeof x.authenticatedSourceSHA256==='string'&&/^[a-f0-9]{64}$/.test(x.authenticatedSourceSHA256),'SOURCE');
  if(['oauth-app','personal-access-token'].includes(x.kind)){if(x.scopes.includes('repo')||x.scopes.includes('public_repo'))need(x.permissions.contents==='write','SCOPE_DOWNGRADE');if(x.scopes.includes('workflow'))need(x.permissions.workflows==='write','SCOPE_DOWNGRADE');}
  const included=x.active&&(a.mode==='all'||a.mode==='selected'&&a.repositoryIds.includes(ID));
  return {kind:x.kind,id:x.id,name:x.name,scopes:[...x.scopes].sort(),permissions:x.permissions,repositoryAccess:a,active:x.active,repositoryIncluded:included,canPotentiallyMerge:included&&x.permissions.contents==='write',canPotentiallyAlterWorkflows:included&&x.permissions.contents==='write'&&x.permissions.workflows==='write'};
 }).sort((a,b)=>(a.kind+':'+a.id).localeCompare(b.kind+':'+b.id,'en'));
 // Stable permission digest survives a renewed observation; raw source captures,
 // authentication provenance and signature stay in the private signed envelope.
 const digest=hashJSON({repository:REPO,repositoryId:ID,ownerId:OWNER,integrations});
 return {integrations,digest,exclusiveTechnicalOwnerControl:integrations.some(x=>x.repositoryIncluded&&Object.values(x.permissions).includes('write'))?false:'NOT VERIFIED'};
}
export function authenticatedApplicationInventory({readSignedAudit,publicKey,keyId,now=Date.now}){
 need(typeof readSignedAudit==='function'&&publicKey?.type==='public'&&publicKey.algorithm?.name==='Ed25519'&&typeof keyId==='string'&&keyId.length>0,'SOURCE_PIN');
 return async()=>{
  let r;try{r=await verifyEvidence(await readSignedAudit(),{publicKey,keyId});}catch{throw Error('APP_AUDIT_UNVERIFIED');}
  const audit=normalizeIntegrationAudit(r,{now:now()});
  // The existing assessor accepts non-GitHub integrations separately; OAuth
  // grants are never fabricated as GitHub installation IDs or human reviewers.
  const installations=r.integrations.filter(x=>x.kind==='github-app'&&x.active&&(x.repositoryAccess.mode==='all'||x.repositoryAccess.mode==='selected'&&x.repositoryAccess.repositoryIds.includes(ID))).map(x=>{need(/^[1-9][0-9]*$/.test(x.appId)&&/^[1-9][0-9]*$/.test(x.installationId),'INSTALLATION_ID');return {appId:x.appId,installationId:x.installationId,repositoryIds:[ID],permissions:x.permissions};});
  return {complete:true,repository:REPO,repositoryId:ID,ownerId:OWNER,observedAt:r.observedAt,installations,integrationEvidence:audit};
 };
}
