// Native systemd MECHANICAL acceptance in disposable Ubuntu CI.
// Signed Owner evidence here is synthetic; never claim real AAL2/provider approval.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir,rm,rmdir} from 'node:fs/promises';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {renderCanonicalExpiryTimer} from '../ops/acceptance-bootstrap/canonical-expiry.mjs';
import {createSystemdExtensionAdapters} from '../ops/acceptance-bootstrap/extension-host.mjs';
import {migrateExtensionGeneration} from '../ops/acceptance-bootstrap/extension-migration.mjs';
import {shouldDeferHostRetirement} from '../ops/acceptance-bootstrap/extension-effective.mjs';
import {hashJSON} from '../lib/publication/contract.mjs';
import {signingKeySHA256} from '../lib/publication/runtime/repository-policy.mjs';
const enabled=process.env.NYRA_NATIVE_EXTENSION==='1'&&process.platform==='linux';
const sh=(f,args)=>execFileSync(f,args,{encoding:'utf8',timeout:20000}).trim();
const sha=s=>createHash('sha256').update(s).digest('hex');
const utc=ms=>new Date(Math.floor(ms/1000)*1000).toISOString().replace('.000Z','Z');
const calendar=s=>s.slice(0,19).replace('T',' ')+' UTC';
test('native root systemd: signed +7d candidate, old timer still armed, durable deferral and exact cleanup', {skip:!enabled,timeout:90000},async()=>{
 assert.equal(process.getuid?.(),0,'Native extension test must run in isolated sudo Ubuntu runner');
 const original='/etc/systemd/system/nyra-repository-expiry.timer';
 const service='/etc/systemd/system/nyra-repository-expiry.service';
 const candidate='/etc/systemd/system/nyra-repository-expiry-extension.timer';
 const journal='/etc/nyra-acceptance/extension-installed.json';
 const targetFile='/etc/nyra-acceptance/target.json';
 const privateBase='/opt/nyra-5c',privateDir=privateBase+'/private',launchFile=privateDir+'/launch.json';
 const now=Date.now(),start=utc(now-1000),old=utc(Date.parse(start)+14*86400000),next=utc(Date.parse(old)+7*86400000);
 const machineId=(await readFile('/etc/machine-id','utf8')).trim();
 assert.match(machineId,/^[a-f0-9]{32}$/);
 const target={schema:'nyra.acceptance.replacement.v2',authorization:false,
  bootstrapId:'nyra-acceptance-native-test-01',hostname:'nyra-acceptance-native-test-01',
  provider:'DigitalOcean',region:'fra1',origin:'https://nyra-acceptance.eliaskalyvas.gr',
  operatorCIDRs:['203.0.113.10/32'],cpu:4,memoryGiB:8,maximumHours:336,optionalResources:false,
  reviewedHead:'29a73458d4cd941e5ed514db56dc2c553d041bda',
  resourceId:'615221105',ipv4:'93.184.216.34',createdAt:start,expiresAt:old};
 const oldTimer=renderCanonicalExpiryTimer(calendar(old));
 const {publicKey,privateKey}=generateKeyPairSync('ed25519');
 const jwk=publicKey.export({format:'jwk'}),keyId='native-owner-synthetic',pin=signingKeySHA256(jwk);
 const issued=utc(now),expires=utc(now+300000);
 const record={schema:'nyra.acceptance.host-extension-approval.v1',repository:'Noctua76/eliaskalyvas-website',
  governanceMode:'SINGLE_OWNER',ownerId:'217035723',bootstrapId:target.bootstrapId,
  providerResourceId:target.resourceId,machineIdSHA256:sha(machineId),oldDeadline:old,newDeadline:next,
  previousGenerationSHA256:sha(oldTimer),decisionId:crypto.randomUUID(),issuedAt:issued,expiresAt:expires};
 const digest=hashJSON(record),envelope={record,digest,keyId,signature:sign(null,Buffer.from(digest),privateKey).toString('base64url')};
 let createdDir=false;
 try{
  for(const p of [original,service,candidate,journal,targetFile,launchFile,privateDir,privateBase]){
   await assert.rejects(readFile(p),e=>e.code==='ENOENT','Must run on a clean disposable runner');
  }
  try{await mkdir('/etc/nyra-acceptance');createdDir=true;}
  catch(e){if(e.code!=='EEXIST')throw e;}
  await writeFile(targetFile,JSON.stringify(target),{flag:'wx',mode:0o600});
  await writeFile(service,'[Unit]\nDescription=NYRA CI synthetic expiry service\n[Service]\nType=oneshot\nExecStart=/usr/bin/true\n',{flag:'wx',mode:0o644});
  await writeFile(original,oldTimer,{flag:'wx',mode:0o644});
  sh('systemctl',['daemon-reload']);
  sh('systemctl',['enable','--now','nyra-repository-expiry.timer']);
  const adapters=createSystemdExtensionAdapters({target,envelope,ownerPublicJWK:jwk,
   ownerKeyId:keyId,expectedKeySHA256:pin,machineId});
  const result=await migrateExtensionGeneration({target,envelope,ownerPublicJWK:jwk,
   ownerKeyId:keyId,expectedKeySHA256:pin,machineId,
   assertFreshOwnerMFA:async()=>true,assertFreshAdministration:async()=>true,...adapters});
  assert.equal(result.status,'NEW_GENERATION_READBACK_AND_RECEIPT_COMMITTED');
  assert.equal(sh('systemctl',['is-enabled','nyra-repository-expiry.timer']),'enabled');
  assert.equal(sh('systemctl',['is-active','nyra-repository-expiry.timer']),'active');
  assert.equal(sh('systemctl',['is-enabled','nyra-repository-expiry-extension.timer']),'enabled');
  assert.equal(sh('systemctl',['is-active','nyra-repository-expiry-extension.timer']),'active');
  await mkdir(privateDir,{recursive:true,mode:0o700});
  await writeFile(launchFile,JSON.stringify({target,configuration:{repositoryTrust:{ownerKey:{id:keyId,sha256:pin}}}}),{flag:'wx',mode:0o600});
  assert.equal(await shouldDeferHostRetirement(),true);
  const persisted=JSON.parse(await readFile(journal,'utf8'));
  assert.equal(persisted.newDeadline,next);
  assert.equal(persisted.status,'committed');
  // No real Owner or provider creation occurs in this mechanical proof.
  assert.equal(result.credentialsExtended,false);
 }finally{
  for(const unit of ['nyra-repository-expiry-extension.timer','nyra-repository-expiry.timer'])
   try{sh('systemctl',['disable','--now',unit]);}catch{}
  for(const p of [candidate,original,service,journal,targetFile,launchFile])
   try{await rm(p,{force:true});}catch{}
  try{sh('systemctl',['daemon-reload']);}catch{}
  if(createdDir)await rmdir('/etc/nyra-acceptance');
  try{await rmdir(privateDir);await rmdir(privateBase);}catch(e){if(e.code!=='ENOENT')throw e;}
 }
});
