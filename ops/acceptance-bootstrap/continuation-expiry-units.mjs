// Offline, non-installing renderer for a FUTURE host exact UTC retirement timer.
// No server creation, no enable/start, no cleanup or authorization here.
// The cleanup executable is an independently reviewed dependency, not supplied here.
import {createHash} from 'node:crypto';
const fail=c=>{throw Error('EXPIRY_UNIT_'+c);};
const need=(v,c)=>{if(!v)fail(c);};
const UTC=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(Date.parse(s)).toISOString()===s;
const sha=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const hash=s=>createHash('sha256').update(s).digest('hex');
const exactKeys=(o,k)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).sort().join('|')===k.slice().sort().join('|');
export function renderContinuationExpiryUnits({lifetime,cleanupCommand,cleanupSHA256,hostIdentitySHA256,now=Date.now}){
 need(lifetime?.schema==='nyra.acceptance.continuation.lifetime.v1'&&lifetime.authorization===false,'HOST_CONTRACT');
 const {proposalSHA256,...data}=lifetime;
 need(sha(proposalSHA256)&&hash(JSON.stringify(data))===proposalSHA256,'HOST_DIGEST');
 need(UTC(lifetime.createdAt)&&UTC(lifetime.expiresAt)&&Date.parse(lifetime.expiresAt)-Date.parse(lifetime.createdAt)===14*86400000,'EXACT_14_DAYS');
 need(Date.parse(lifetime.expiresAt)>now(),'NOT_EXPIRED');
 need(sha(cleanupSHA256)&&sha(hostIdentitySHA256),'MISSING_PINS');
 // The command is a fixed, root-controlled absolute pathname. No arguments,
 // untrusted interpolation or shell. Never accept old-host cleanup paths.
 need(typeof cleanupCommand==='string'&&/^\/usr\/local\/lib\/nyra-continuation\/[a-z0-9][a-z0-9-]{2,60}\.mjs$/.test(cleanupCommand),'CLEANUP_PATH');
 need(typeof lifetime.bootstrapId==='string'&&/^nyra-acceptance-[a-z0-9-]{6,80}$/.test(lifetime.bootstrapId)&&lifetime.bootstrapId!=='nyra-acceptance-20261102-01','OLD_HOST');
 const calendar=lifetime.expiresAt.slice(0,10)+' '+lifetime.expiresAt.slice(11,19)+' UTC';
 const service=[
  '[Unit]','Description=NYRA exact-host retirement (reviewed cleanup dependency)','ConditionPathExists='+cleanupCommand,
  '[Service]','Type=oneshot','User=root','Group=root','UMask=0077',
  'ExecStart=/usr/bin/node '+cleanupCommand,
  'NoNewPrivileges=true','ProtectSystem=strict','ProtectHome=read-only','PrivateTmp=true',
  'StandardOutput=journal','StandardError=journal',''
 ].join('\n');
 const timer=[
  '[Unit]','Description=NYRA exact-host retirement deadline',
  '[Timer]','Unit=nyra-continuation-expiry.service','OnCalendar='+calendar,
  'AccuracySec=1s','Persistent=true',
  '[Install]','WantedBy=timers.target',''
 ].join('\n');
 // These are REVIEWABLE TEMPLATES. A reviewed installer MUST verify all pins
 // including the exact file content before putting either file on a host.
 return Object.freeze({
  schema:'nyra.acceptance.continuation.expiry-unit-proposal.v1',
  bootstrapId:lifetime.bootstrapId,
  hostProposalSHA256:proposalSHA256,
  hostIdentitySHA256,
  cleanupSHA256,
  deadline:lifetime.expiresAt,
  calendar,
  service,
  timer,
  serviceSHA256:hash(service),
  timerSHA256:hash(timer),
  status:'OFFLINE_ONLY_NOT_INSTALLED',
  installApproved:false,
  enforcementVerified:false,
  credentialValidityExtended:false,
  providerDeletionScheduled:false
 });
}
