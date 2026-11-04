// Public target data only. A planned target never establishes host readiness.
import {isIP} from 'node:net';
import {hashJSON} from '../../lib/publication/contract.mjs';
const need=(v,c)=>{if(!v)throw Error('REPLACEMENT_'+c);};
// One-time Stage 3 exception: exact owner-approved acceptance target only.
// The default 24-hour limit remains unchanged for every other target.
const STAGE3_EXTENSION=Object.freeze({
 bootstrapId:'nyra-acceptance-20261102-01',
 hostname:'nyra-acceptance-20261102-01',
 resourceId:'615221104',
 ipv4:'139.59.136.219',
 origin:'https://nyra-acceptance.eliaskalyvas.gr',
 createdAt:'2026-11-02T21:06:46Z',
 expiresAt:'2026-11-04T21:05:00Z'
});
function approvedStage3Extension(t,start,end){
 return t.bootstrapId===STAGE3_EXTENSION.bootstrapId&&
  t.hostname===STAGE3_EXTENSION.hostname&&
  t.resourceId===STAGE3_EXTENSION.resourceId&&
  t.ipv4===STAGE3_EXTENSION.ipv4&&
  t.origin===STAGE3_EXTENSION.origin&&
  t.expiresAt===STAGE3_EXTENSION.expiresAt&&
  t.createdAt===STAGE3_EXTENSION.createdAt&&
  start===Date.parse(STAGE3_EXTENSION.createdAt)&&
  end-start<=48*60*60*1000;
}

// v2 is the NEW 14-day host contract; v1 remains strictly legacy/24h.
// Host lifespan is not a protected session or a credential lease.
export const CONTINUATION_HOST_MS=14*24*60*60*1000;
const exactUTC=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(Date.parse(s)).toISOString().replace('.000Z','Z')===s;
export function validateReplacementTarget(t,{created=false,allowExpired=false,now=Date.now}={}){
 need(t&&Object.keys(t).sort().join(',')===['schema','bootstrapId','hostname','provider','region','origin','operatorCIDRs','cpu','memoryGiB','maximumHours','optionalResources','reviewedHead','resourceId','ipv4','createdAt','expiresAt','authorization'].sort().join(','),'FIELDS');
 const continuation=t?.schema==='nyra.acceptance.replacement.v2';
 need((continuation||t?.schema==='nyra.acceptance.replacement.v1')&&t.provider==='DigitalOcean'&&t.region==='fra1'&&t.authorization===false,'TARGET');
 if(continuation)need(t.bootstrapId!=='nyra-acceptance-20261102-01'&&t.hostname===t.bootstrapId,'NEW_HOST_REQUIRED');
 need(/^[a-z0-9-]{8,50}$/.test(t.bootstrapId)&&/^nyra-[a-z0-9-]{3,50}$/.test(t.hostname)&&t.hostname!=='nyra-5c-acceptance'&&!t.hostname.includes('pr20'),'RETIRED_HOST');
 const u=new URL(t.origin);need(u.protocol==='https:'&&u.origin===t.origin&&u.port===''&&!u.username&&!u.password&&/^[a-z0-9.-]+$/.test(u.hostname)&&u.hostname!=='nyra-5c.eliaskalyvas.gr'&&u.hostname.endsWith('.eliaskalyvas.gr'),'ORIGIN');
 need(t.maximumHours===(continuation?336:24)&&t.cpu===4&&t.memoryGiB===8&&t.optionalResources===false,'RESOURCE_SCOPE');
 need(Array.isArray(t.operatorCIDRs)&&t.operatorCIDRs.length>0&&t.operatorCIDRs.every(x=>/^\d+\.\d+\.\d+\.\d+\/32$/.test(x)&&isIP(x.slice(0,-3))===4&&!x.startsWith('0.')),'SSH_SCOPE');
 need(t.reviewedHead===(continuation?'29a73458d4cd941e5ed514db56dc2c553d041bda':'1dbeb46c4ad7ac39dfc313bf47361bf2868e50ee'),'REVIEWED_BASE');
 if(created){
  need(typeof t.resourceId==='string'&&/^[1-9][0-9]{0,19}$/.test(t.resourceId)&&isIP(t.ipv4)===4&&!/^(0|10|127|169\.254|192\.168|172\.(1[6-9]|2[0-9]|3[01]))\./.test(t.ipv4)&&t.ipv4!=='201.79.94.104','NEW_RESOURCE');
  const start=Date.parse(t.createdAt),end=Date.parse(t.expiresAt);need(Number.isFinite(start)&&Number.isFinite(end)&&start<=now()&&(allowExpired||now()<end)&&end>start&&
   (continuation?(exactUTC(t.createdAt)&&exactUTC(t.expiresAt)&&end-start===CONTINUATION_HOST_MS&&t.resourceId!=='615221104'):(end-start<=86400000||approvedStage3Extension(t,start,end))),'DEADLINE');
 }else need(t.resourceId===null&&t.ipv4===null&&t.createdAt===null&&t.expiresAt===null,'PRECREATE_ONLY');
 return Object.freeze({targetSHA256:hashJSON(t),created,authorization:false,liveAcceptance:false});
}
export function assessReplacementHost(t,o,{now=Date.now}={}){
 validateReplacementTarget(t,{created:true,now});
 const ok={identity:o.hostname===t.hostname&&o.providerResourceId===t.resourceId&&o.providerRegion==='fra1'&&o.publicIPv4===t.ipv4,
  os:o.os==='ubuntu:24.04:amd64',capacity:o.cpu>=4&&o.memoryGiB>=7.25&&o.freeDiskGiB>=20,
  dnsTLS:Array.isArray(o.dnsAddresses)&&o.dnsAddresses.length>0&&o.dnsAddresses.every(ip=>ip===t.ipv4)&&o.httpsStatus===404&&o.tlsVerified===true,
  hostFirewall:o.hostFirewall?.defaultInbound==='deny'&&JSON.stringify(o.hostFirewall.sshCIDRs)===JSON.stringify(t.operatorCIDRs)&&JSON.stringify(o.hostFirewall.publicTCP)==='[80,443]'&&JSON.stringify(o.hostFirewall.publicUDP)==='[]',
  providerFirewall:o.providerFirewall?.resourceId===t.resourceId&&o.providerFirewall.defaultInbound==='deny'&&JSON.stringify(o.providerFirewall.sshCIDRs)===JSON.stringify(t.operatorCIDRs)&&JSON.stringify(o.providerFirewall.publicTCP)==='[80,443]'&&JSON.stringify(o.providerFirewall.publicUDP)==='[]',
  freshHost:Array.isArray(o.runningContainers)&&o.runningContainers.length===0&&Array.isArray(o.privateFiles)&&o.privateFiles.length===0,
  pins:typeof o.verifiedPrerequisitesSHA256==='string'&&/^[a-f0-9]{64}$/.test(o.verifiedPrerequisitesSHA256)&&o.verifiedPrerequisitesSHA256===o.expectedPrerequisitesSHA256,
  deadline:o.timerEnabled===true&&o.timerExpiresAt===t.expiresAt};
 return {checks:ok,hostPrerequisitesPassed:Object.values(ok).every(Boolean),readyForCredentials:false,independentAdministration:false,authorization:false};
}
