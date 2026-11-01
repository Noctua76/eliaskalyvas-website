// Public target data only. A planned target never establishes host readiness.
import {isIP} from 'node:net';
import {hashJSON} from '../../lib/publication/contract.mjs';
const need=(v,c)=>{if(!v)throw Error('REPLACEMENT_'+c);};
export function validateReplacementTarget(t,{created=false,allowExpired=false,now=Date.now}={}){
 need(t&&Object.keys(t).sort().join(',')===['schema','bootstrapId','hostname','provider','region','origin','operatorCIDRs','cpu','memoryGiB','maximumHours','optionalResources','reviewedHead','resourceId','ipv4','createdAt','expiresAt','authorization'].sort().join(','),'FIELDS');
 need(t?.schema==='nyra.acceptance.replacement.v1'&&t.provider==='DigitalOcean'&&t.region==='fra1'&&t.authorization===false,'TARGET');
 need(/^[a-z0-9-]{8,50}$/.test(t.bootstrapId)&&/^nyra-[a-z0-9-]{3,50}$/.test(t.hostname)&&t.hostname!=='nyra-5c-acceptance'&&!t.hostname.includes('pr20'),'RETIRED_HOST');
 const u=new URL(t.origin);need(u.protocol==='https:'&&u.origin===t.origin&&u.port===''&&!u.username&&!u.password&&/^[a-z0-9.-]+$/.test(u.hostname)&&u.hostname!=='nyra-5c.eliaskalyvas.gr'&&u.hostname.endsWith('.eliaskalyvas.gr'),'ORIGIN');
 need(t.maximumHours===24&&t.cpu===4&&t.memoryGiB===8&&t.optionalResources===false,'RESOURCE_SCOPE');
 need(Array.isArray(t.operatorCIDRs)&&t.operatorCIDRs.length>0&&t.operatorCIDRs.every(x=>/^\d+\.\d+\.\d+\.\d+\/32$/.test(x)&&isIP(x.slice(0,-3))===4&&!x.startsWith('0.')),'SSH_SCOPE');
 need(t.reviewedHead==='1dbeb46c4ad7ac39dfc313bf47361bf2868e50ee','REVIEWED_BASE');
 if(created){
  need(typeof t.resourceId==='string'&&/^[1-9][0-9]{0,19}$/.test(t.resourceId)&&isIP(t.ipv4)===4&&!/^(0|10|127|169\.254|192\.168|172\.(1[6-9]|2[0-9]|3[01]))\./.test(t.ipv4)&&t.ipv4!=='201.79.94.104','NEW_RESOURCE');
  const start=Date.parse(t.createdAt),end=Date.parse(t.expiresAt);need(Number.isFinite(start)&&Number.isFinite(end)&&start<=now()&&(allowExpired||now()<end)&&end>start&&end-start<=86400000,'DEADLINE');
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
