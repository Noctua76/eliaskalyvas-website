// Standalone, separately reviewed operator utility; never imported by runtime.
// --plan / --decision are read-only. --enforce is ONLY for separately approved
// installed expiry units. There is deliberately no deploy/apply/retry command.
import {createHash} from 'node:crypto';
import {readFile,lstat,realpath} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {hostname} from 'node:os';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
export const BASE='29a73458d4cd941e5ed514db56dc2c553d041bda';
export const OLD='2026-11-04T21:05:00Z',END='2026-11-05T21:05:00Z';
export const HOST=Object.freeze({bootstrapId:'nyra-acceptance-20261102-01',hostname:'nyra-acceptance-20261102-01',resourceId:'615221104',ipv4:'139.59.136.219',origin:'https://nyra-acceptance.eliaskalyvas.gr',createdAt:'2026-11-02T21:06:46Z'});
const need=(v,c)=>{if(!v)throw Error(c);},hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v),sha40=v=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v);
export const sha=b=>createHash('sha256').update(b).digest('hex');
// Canonical JSON for parsed records (same safe-integer JSON domain as contracts).
export function canonical(v){if(v===null||typeof v==='string'||typeof v==='boolean')return JSON.stringify(v);if(typeof v==='number'){need(Number.isSafeInteger(v)&&!Object.is(v,-0),'JSON_NUMBER');return JSON.stringify(v);}if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';need(v&&typeof v==='object'&&Object.getPrototypeOf(v)===Object.prototype,'JSON_OBJECT');return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';}
export const hashJSON=v=>sha(Buffer.from(canonical(v)));
export function exactTarget(t,deadline){need(Object.entries(HOST).every(([k,v])=>t?.[k]===v)&&t.expiresAt===deadline&&t.provider==='DigitalOcean'&&t.region==='fra1'&&t.maximumHours===24&&t.authorization===false,'EXACT_TARGET');}
const roles=['build','inspection','publication'];
export function proposeConfiguration({target,launch,ownerSource,input,newSourceSHA,inputFileSHA256},tools){
 exactTarget(target,OLD);need(hex(inputFileSHA256),'ORIGINAL_INPUT_RAW_PIN');need(sha40(newSourceSHA)&&newSourceSHA!==BASE,'NEW_REVIEWED_SOURCE_REQUIRED');
 need(hashJSON(launch.target)===hashJSON(target)&&launch.configuration.repositoryTrust.sourceSHA===BASE&&input.sourceSHA===BASE,'OLD_CONFIG_PINS');
 need(ownerSource.policy.windowEndsAt===OLD&&hashJSON(ownerSource.policy.repositoryTrust)===hashJSON(launch.configuration.repositoryTrust),'OWNER_CONFIG_PINS');
 const before={target,launch,ownerSource,input},next=structuredClone(before),c=next.launch.configuration,t=c.repositoryTrust;
 const previousTrustSHA256=hashJSON(t),oldPolicies=tools.reviewedAcceptancePolicies(c);
 need(hashJSON(ownerSource.policy.allowedPolicySHA256s)===hashJSON(roles.map(r=>hashJSON(oldPolicies[r])))&&roles.every(r=>launch.policyStates[r]?.policySHA256===hashJSON(oldPolicies[r])&&launch.policyStates[r].mode===c.governance.mode&&launch.policyStates[r].policyVersion===c.governance.policyVersion&&launch.policyStates[r].ownerAuthorizationSHA===c.governance.ownerAuthorizationSHA),'OLD_POLICY_GENERATION');
 need(hashJSON(ownerSource.auth)===hashJSON(input.ownerAuth)&&ownerSource.policy.ownerAuthUserId===input.ownerAuth.ownerAuthUserId,'EXISTING_OWNER_AUTH_BINDING');
 next.target.expiresAt=END;next.launch.target=next.target;
 for(const p of Object.values(c.identities)){need(p.callerSHA===BASE&&p.codeSHA===BASE,'IDENTITY_SOURCE');p.callerSHA=newSourceSHA;p.codeSHA=newSourceSHA;}
 t.sourceSHA=newSourceSHA;t.version++;t.identitiesSHA256=hashJSON(c.identities);
 const policies=tools.reviewedAcceptancePolicies(c);next.launch.policyStates=Object.fromEntries(roles.map(r=>[r,{...launch.policyStates[r],policySHA256:hashJSON(policies[r])}]));
 next.ownerSource.acceptanceTarget=next.target;next.ownerSource.policy={...next.ownerSource.policy,windowEndsAt:END,repositoryTrust:t,allowedPolicySHA256s:roles.map(r=>hashJSON(policies[r]))};
 next.input={schema:'nyra.stage3.extension-input.v1',previousInputSHA256:inputFileSHA256,previousInputCanonicalSHA256:hashJSON(input),previousSourceSHA:BASE,sourceSHA:newSourceSHA,targetSHA256:hashJSON(next.target),launchSHA256:hashJSON(next.launch),ownerSourceSHA256:hashJSON(next.ownerSource),previousRepositoryTrustSHA256:previousTrustSHA256,repositoryTrustSHA256:hashJSON(t),authorization:false};
 need(hashJSON(c.governance)===hashJSON(launch.configuration.governance)&&t.governanceSHA256===launch.configuration.repositoryTrust.governanceSHA256&&t.configurationSHA256===launch.configuration.repositoryTrust.configurationSHA256&&hashJSON(t.ownerKey)===hashJSON(launch.configuration.repositoryTrust.ownerKey)&&hashJSON(t.retirementKey)===hashJSON(launch.configuration.repositoryTrust.retirementKey)&&hashJSON(t.knownAuthorities)===hashJSON(launch.configuration.repositoryTrust.knownAuthorities),'IMMUTABLE_BINDINGS');
 return {beforeSHA256:hashJSON(before),previousPolicySHA256s:roles.map(r=>hashJSON(oldPolicies[r])),proposed:next,activePolicyState:false,keysGenerated:0,authorization:false};
}
export function reviewedInventory(raw,review,ownerReviewSHA256){
 const {observedAt,...stable}=raw;
 need(review?.schema==='nyra.acceptance.extension.independent-review.v1'&&review.inventoryContextSHA256===hashJSON(stable)&&review.ownerReviewSHA256===ownerReviewSHA256&&hex(ownerReviewSHA256),'INDEPENDENT_REVIEW_BINDING');
 need(review.provider?.resourceId===HOST.resourceId&&review.provider.hostname===HOST.hostname&&review.provider.ipv4===HOST.ipv4&&review.provider.authenticatedReadback===true&&review.provider.status==='active'&&hex(review.provider.evidenceSHA256),'AUTHENTICATED_PROVIDER_REVIEW');
 need(review.scheduledTasks?.completeReview===true&&review.scheduledTasks.noEarlierDestructiveJob===true&&hex(review.scheduledTasks.evidenceSHA256),'ALL_SCHEDULED_TASKS_REVIEW');
 return {...raw,providerIdentityVerified:true,legacyDestructiveTimersAbsent:true,independentReviewSHA256:hashJSON(review)};
}
export function migrationPlan(o,{newSourceSHA,ownerReviewSHA256,dbCredentialApprovalSHA256},now=Date.now()){
 need(o?.schema==='nyra.acceptance.extension.inventory.v1'&&o.hostname===HOST.hostname&&o.resourceId===HOST.resourceId&&o.ipv4===HOST.ipv4,'HOST_INVENTORY');
 const observed=Date.parse(o.observedAt);need(Number.isFinite(observed)&&observed<=now&&now-observed<60000&&now<Date.parse(OLD)-300000,'FRESH_PRE_DEADLINE_INVENTORY');
 need(o.deadline===OLD&&o.sourceSHA===BASE&&o.sourceClean===true&&o.stagedCount===57&&o.stagedMatch===true&&hex(o.oldTargetSHA256)&&hex(o.newTargetSHA256)&&o.oldTargetSHA256!==o.newTargetSHA256,'SOURCE_TARGET_INVENTORY');
 need(o.oldTimer?.active===true&&o.oldTimer.enabled===true&&o.oldTimer.persistent===true&&o.oldTimer.deadline===OLD&&o.oldTimer.nextTrigger===OLD&&hex(o.oldTimer.unitSHA256)&&hex(o.oldTimer.cleanupSHA256),'OLD_ENFORCEMENT');
 need(o.cleanupStarted===false&&o.runtimeInactive===true&&o.ownerInactive===true&&o.liveRoleContainers===0&&o.policyStateAbsent===true&&o.runtimeArtifactsAbsent===true&&o.extensionAttemptAbsent===true&&o.activeRegistrations===0,'QUIESCENT_ONLY');
 need(o.databasePreserved===true&&o.databaseRoleAttributesSafe===true&&o.databaseTargetSHA256===o.oldTargetSHA256&&o.networkTargetSHA256===o.oldTargetSHA256&&o.networkInternal===true&&o.publicDatabasePorts===0&&o.firewallVerified===true&&o.providerIdentityVerified===true&&o.legacyDestructiveTimersAbsent===true,'ISOLATION_OR_PROVIDER_NOT_VERIFIED');
 need(['nyra_accept_registrar','nyra_accept_broker'].every(r=>o.databaseRoles?.[r]===OLD),'DATABASE_EXPIRY');
 need(hex(o.immutableInventorySHA256)&&hex(ownerReviewSHA256)&&hex(dbCredentialApprovalSHA256)&&sha40(newSourceSHA)&&newSourceSHA!==BASE,'INDEPENDENT_REVIEW_PINS');
 const plan={schema:'nyra.acceptance.extension.plan.v1',host:HOST,previousDeadline:OLD,deadline:END,generation:2,previousSourceSHA:BASE,newSourceSHA,oldTargetSHA256:o.oldTargetSHA256,newTargetSHA256:o.newTargetSHA256,inventorySHA256:hashJSON(o),immutableInventorySHA256:o.immutableInventorySHA256,ownerReviewSHA256,dbCredentialApprovalSHA256,steps:['reserve-exclusive-attempt-and-private-history','install-and-verify-new-persistent-expiry','install-old-deadline-fail-closed-router','verify-quiescence-and-source-rollover-candidate','stage-new-config-generation-without-activation','separately-approved-db-validity-transaction','install-source-and-57-byte-verified-stage','install-config-generation-while-old-deadline-armed','independent-source-config-db-timer-verification','commit-receipt-once-before-old-deadline'],authorization:false};
 return {plan,digest:hashJSON(plan),executionApproved:false};
}
export function validatePlan(e){const p=e?.plan;need(p&&e.digest===hashJSON(p)&&p.schema==='nyra.acceptance.extension.plan.v1'&&hashJSON(p.host)===hashJSON(HOST)&&p.previousDeadline===OLD&&p.deadline===END&&Date.parse(END)-Date.parse(OLD)===86400000&&p.generation===2&&p.previousSourceSHA===BASE&&sha40(p.newSourceSHA)&&p.newSourceSHA!==BASE&&p.authorization===false&&[p.oldTargetSHA256,p.newTargetSHA256,p.inventorySHA256,p.immutableInventorySHA256,p.ownerReviewSHA256,p.dbCredentialApprovalSHA256].every(hex)&&p.oldTargetSHA256!==p.newTargetSHA256,'SEALED_PLAN');return p;}
export function commitReceipt(e,proof,now=Date.now()){
 const p=validatePlan(e);need(now<Date.parse(OLD)-300000,'COMMIT_WINDOW_ENDED');
 need(proof?.planSHA256===e.digest&&proof.generation===2&&proof.sourceSHA===p.newSourceSHA&&proof.targetSHA256===p.newTargetSHA256&&hex(proof.launchSHA256)&&hex(proof.ownerSourceSHA256)&&hex(proof.reviewedInputSHA256)&&hex(proof.unitPinsSHA256),'GENERATION_PINS');
 need(proof.attemptReserved===true&&proof.commitAlreadyExists===false&&proof.sourceClean===true&&proof.stagedCount===57&&proof.stagedMatch===true&&proof.immutableInventorySHA256===p.immutableInventorySHA256&&proof.oldEnforcementArmed===true&&proof.newEnforcementVerified===true&&proof.newTimerNextTrigger===END&&proof.newTimerPersistent===true&&proof.databaseRolesMatch===true&&proof.rolesAndOwnerInactive===true&&proof.policyStateAbsent===true&&proof.activeRegistrations===0&&proof.providerIdentityVerified===true&&proof.collectorCompatible===true,'POST_APPLY_NOT_VERIFIED');
 return {schema:'nyra.acceptance.extension.commit.v1',status:'COMMITTED',generation:2,previousDeadline:OLD,deadline:END,previousTargetSHA256:p.oldTargetSHA256,targetSHA256:p.newTargetSHA256,sourceSHA:p.newSourceSHA,launchSHA256:proof.launchSHA256,ownerSourceSHA256:proof.ownerSourceSHA256,reviewedInputSHA256:proof.reviewedInputSHA256,unitPinsSHA256:proof.unitPinsSHA256,planSHA256:e.digest,committedAt:new Date(now).toISOString(),authorization:false};
}
export function expiryDecision(e,receipt,o,now=Date.now()){
 const p=validatePlan(e);if(now<Date.parse(OLD))return 'KEEP_ORIGINAL_DEADLINE';
 if(now>=Date.parse(END))return 'RETIRE_BOTH_GENERATIONS';
 const r=receipt;
 const coherent=r?.status==='COMMITTED'&&r.schema==='nyra.acceptance.extension.commit.v1'&&r.generation===2&&r.planSHA256===e.digest&&r.previousDeadline===OLD&&r.deadline===END&&r.sourceSHA===p.newSourceSHA&&r.previousTargetSHA256===p.oldTargetSHA256&&r.targetSHA256===p.newTargetSHA256&&r.authorization===false&&Date.parse(r.committedAt)<Date.parse(OLD)-300000;
 return coherent&&o?.sourceSHA===r.sourceSHA&&o.targetSHA256===r.targetSHA256&&o.launchSHA256===r.launchSHA256&&o.ownerSourceSHA256===r.ownerSourceSHA256&&o.reviewedInputSHA256===r.reviewedInputSHA256&&o.newTimerActive===true&&o.newTimerEnabled===true&&o.newTimerPersistent===true&&o.newTimerNextTrigger===END&&o.newUnitPinsMatch===true&&o.unitPinsSHA256===r.unitPinsSHA256?'NEW_DEADLINE_ENFORCED':'RETIRE_BOTH_GENERATIONS';
}
export function recoveryDecision({oldFilesVerified,anyNewGeneration,cleanupStarted},now=Date.now()){
 if(cleanupStarted)return 'NO_RESOURCE_PRESERVATION_GUARANTEE';
 if(now>=Date.parse(OLD))return 'NO_ROLLBACK_TO_EXPIRED_WINDOW_RETIRE_UNLESS_VERIFIED_COMMIT';
 return oldFilesVerified&&!anyNewGeneration?'PRESERVE_OLD_DEADLINE_NO_RETRY':'STOP_SEPARATELY_APPROVED_RECOVERY_OLD_DEADLINE_STILL_ENFORCED';
}
export function renderUnits({helperSHA256,planFileSHA256}){
 need(hex(helperSHA256)&&hex(planFileSHA256),'UNIT_PINS');
 const base='/usr/local/lib/nyra-extension-20261105',command='/usr/local/bin/node '+base+'/extension-20261105.mjs --enforce '+base+'/plan.json '+planFileSHA256+' '+helperSHA256;
 const service='[Unit]\nDescription=NYRA exact reviewed 24-hour extension retirement\nAfter=docker.service\n[Service]\nType=oneshot\nUser=root\nGroup=root\nEnvironment=NODE_OPTIONS=\nExecStart='+command+'\n';
 const timer='[Unit]\nDescription=NYRA fixed November 5 retirement (no renewal)\n[Timer]\nOnCalendar=2026-11-05 21:05:00 UTC\nAccuracySec=1s\nRandomizedDelaySec=0\nPersistent=true\nUnit=nyra-repository-extension-expiry.service\n[Install]\nWantedBy=timers.target\n';
 return {service,timer,oldServiceDropIn:'[Service]\nExecStart=\nExecStart='+command+'\n'};
}
export function dbValiditySQL(e){const p=validatePlan(e);return "begin;\nselect pg_advisory_xact_lock(615221104);\ndo $$ begin if (select count(*) from pg_roles where rolname in ('nyra_accept_registrar','nyra_accept_broker') and rolvaliduntil='"+p.previousDeadline+"'::timestamptz and rolcanlogin and not rolsuper and not rolcreaterole and not rolcreatedb and not rolbypassrls)<>2 then raise exception 'ROLE_GENERATION_MISMATCH'; end if; end $$;\nalter role nyra_accept_registrar valid until '"+p.deadline+"';\nalter role nyra_accept_broker valid until '"+p.deadline+"';\ncommit;\n";}
const run=(f,a)=>execFileSync(f,a,{encoding:'utf8',timeout:30000,env:{PATH:process.env.PATH,GIT_OPTIONAL_LOCKS:'0'},stdio:['ignore','pipe','pipe']}).trim();
async function rootJSON(path){need(await realpath(path)===path,'SEALED_FILE_PATH');const s=await lstat(path);need(s.isFile()&&s.uid===0&&s.nlink===1&&(s.mode&0o777)===0o600&&s.size<2000000,'SEALED_FILE');return JSON.parse(await readFile(path,'utf8'));}
async function observedGeneration(){
 const base='/usr/local/lib/nyra-extension-20261105',timer='nyra-repository-extension-expiry.timer',o={};
 try{
  const r=await rootJSON('/etc/nyra-acceptance/extension-20261105.json');
  const target=await rootJSON('/etc/nyra-acceptance/target.json'),launch=await rootJSON('/opt/nyra-5c/private/launch.json');
  o.sourceSHA=run('git',['--no-optional-locks','-C','/opt/nyra-5c/bootstrap','rev-parse','HEAD']);
  o.targetSHA256=hashJSON(target);o.launchSHA256=hashJSON(launch);
  // These files contain public configuration / provenance, not private signers.
  o.ownerSourceSHA256=hashJSON(JSON.parse(await readFile('/var/lib/nyra-5c/owner/source.json','utf8')));
  o.reviewedInputSHA256=hashJSON(await rootJSON('/opt/nyra-5c/private/stage3-extension-input.json'));
  o.newTimerActive=run('systemctl',['is-active',timer])==='active';o.newTimerEnabled=run('systemctl',['is-enabled',timer])==='enabled';
  o.newTimerPersistent=run('systemctl',['show',timer,'--property=Persistent','--value'])==='yes';
  const calendar=run('systemctl',['show',timer,'--property=TimersCalendar','--value']);
  const next=run('systemctl',['show',timer,'--property=NextElapseUSecRealtime','--value']);
  o.newTimerNextTrigger=Date.parse(next)===Date.parse(END)&&calendar.includes('2026-11-05 21:05:00')?END:null;
  const pins=await rootJSON(base+'/unit-pins.json');o.unitPinsSHA256=sha(await readFile(base+'/unit-pins.json'));o.newUnitPinsMatch=sha(await readFile('/etc/systemd/system/nyra-repository-extension-expiry.timer'))===pins.timer&&sha(await readFile('/etc/systemd/system/nyra-repository-extension-expiry.service'))===pins.service;
  return {receipt:r,observation:o};
 }catch{return {receipt:null,observation:o};}
}
// Same exact-label/inspect/absence semantics as reviewed cleanup.mjs. This
// independent fallback must not depend on a half-replaced runtime/target file.
export async function retireGenerations(e,{execute=(a)=>run('docker',a),remove,now=Date.now()}={}){
 const p=validatePlan(e);need(now>=Date.parse(OLD),'RETIREMENT_TOO_EARLY');
 const removed=[];
 const ids=args=>{const v=execute(args).split(/\s+/).filter(Boolean);need(v.every(x=>/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(x)),'RESOURCE_ID');return v;};
 for(const [kind,list,del]of [['container',['ps','-aq','--no-trunc'],['rm','-f']],['network',['network','ls','-q','--no-trunc'],['network','rm']],['volume',['volume','ls','-q'],['volume','rm']]])for(const digest of [p.oldTargetSHA256,p.newTargetSHA256])for(const id of ids([...list,'--filter','label=com.noctua.nyra.acceptance='+digest])){
  const rows=JSON.parse(execute([kind,'inspect',id])),labels=kind==='container'?rows[0]?.Config?.Labels:rows[0]?.Labels;need(labels?.['com.noctua.nyra.acceptance']===digest,'CLEANUP_SCOPE');execute([...del,id]);need(!ids(list).includes(id),'CLEANUP_REMAINS');removed.push({kind,id});
 }
 // Exact original private-file retirement list only. App/attempt secrets remain
 // explicit operator inventory; never broad rm / root-directory traversal.
 if(remove)for(const role of ['registrar','broker','owner','coordinator'])for(const name of ['pg.json','ipc.json','evidence-key.json','owner-key.json','admin-read.json','repository.json','role-ipc.json'])await remove('/var/lib/nyra-5c/'+role+'/'+name);
 if(remove)await remove('/opt/nyra-5c/private/repository-db.env');
 return {removed,providerDestroyed:false,manualRetirementRequired:true,authorization:false};
}
async function main(){
 const a=process.argv.slice(2);need(['--plan','--decision','--enforce'].includes(a[0]),'MODE');
 if(a[0]==='--plan'){need(a.length===3,'USAGE');const raw=JSON.parse(await readFile(a[1],'utf8')),request=JSON.parse(await readFile(a[2],'utf8'));const o=reviewedInventory(raw,request.independentReview,request.ownerReviewSHA256);console.log(JSON.stringify(migrationPlan(o,request),null,2));return;}
 if(a[0]==='--decision'){need(a.length===4,'USAGE');console.log(expiryDecision(JSON.parse(await readFile(a[1],'utf8')),JSON.parse(await readFile(a[2],'utf8')),JSON.parse(await readFile(a[3],'utf8'))));return;}
 need(a.length===4&&process.getuid?.()===0&&hostname()===HOST.hostname&&hex(a[2])&&hex(a[3]),'INSTALLED_ENFORCEMENT_ONLY');
 need(sha(await readFile(new URL(import.meta.url)))===a[3]&&sha(await readFile(a[1]))===a[2],'ENFORCEMENT_BYTES');
 const e=await rootJSON(a[1]);validatePlan(e);const {receipt,observation}=await observedGeneration();const decision=expiryDecision(e,receipt,observation);
 if(decision==='RETIRE_BOTH_GENERATIONS'){
  // Only reached at/after the original deadline. No launch, dispatch or renewal.
  for(const unit of ['nyra-caddy.service','nyra-repository-runtime.service','nyra-owner-source.service'])run('systemctl',['stop',unit]);
  const {unlink}=await import('node:fs/promises');console.log(JSON.stringify(await retireGenerations(e,{remove:async path=>{try{await unlink(path);}catch(x){if(x.code!=='ENOENT')throw x;}}})));
 }else console.log(JSON.stringify({decision,authorization:false}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(()=>{console.error('NYRA_EXTENSION_CLOSED_NO_AUTOMATIC_RECOVERY');process.exitCode=1;});
