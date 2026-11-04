#!/usr/bin/env python3
"""Root-local read-only facts. No provider API, secret output or mutation.
A report is NOT approval. Provider/unknown scheduled-task review stays explicit.
"""
import os,json,pathlib,subprocess,hashlib,datetime,socket,stat,sys
ROOT=pathlib.Path('/opt/nyra-5c/bootstrap');LIVE=pathlib.Path('/opt/nyra-5c/live-runtime');PRIVATE=pathlib.Path('/opt/nyra-5c/private');BASE=pathlib.Path('/var/lib/nyra-5c')
def need(v,c):
 if not v:raise RuntimeError(c)
def sha(b):return hashlib.sha256(b).hexdigest()
def hashj(v):return sha(json.dumps(v,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode())
def run(*args):return subprocess.check_output(args,text=True,stderr=subprocess.DEVNULL,env={'PATH':os.environ['PATH'],'GIT_OPTIONAL_LOCKS':'0'}).strip()
def probe(*args):return subprocess.run(args,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0
def file(p):
 s=p.lstat();need(p.resolve()==p and stat.S_ISREG(s.st_mode) and s.st_nlink==1,'REGULAR_FILE');return p.read_bytes()
def metadata(p):
 s=p.lstat();return {'uid':s.st_uid,'gid':s.st_gid,'mode':oct(stat.S_IMODE(s.st_mode)),'inode':str(s.st_ino),'device':str(s.st_dev),'size':s.st_size,'mtimeNs':str(s.st_mtime_ns),'ctimeNs':str(s.st_ctime_ns),'symlink':p.is_symlink()}
def main():
 need(sys.argv[1:]==['--collect'] and os.geteuid()==0,'ROOT_READ_ONLY_COLLECT_ONLY')
 target=json.loads(file(pathlib.Path('/etc/nyra-acceptance/target.json')));extended={**target,'expiresAt':'2026-11-05T21:05:00Z'}
 manifest=json.loads(file(LIVE/'runtime-files.json'));need(len(manifest)==57 and len(set(manifest))==57 and all(isinstance(p,str) and '..' not in pathlib.PurePosixPath(p).parts and not p.startswith('/') for p in manifest),'MANIFEST_57')
 staged={p:{'source':sha(file(ROOT/p)),'live':sha(file(LIVE/p))} for p in manifest}
 snapshots={};immutable={}
 for p in [PRIVATE/'stage3-reviewed-input.json',PRIVATE/'stage3-provisioning-attempt.json',BASE/'coordinator/governance.json',BASE/'coordinator/owner-public.json',BASE/'coordinator/evidence-public.json',BASE/'registrar/pg.json',BASE/'broker/pg.json']:
  row={'sha256':sha(file(p)),'metadata':metadata(p)};snapshots[str(p)]=row;immutable[str(p)]=row
 for p in [BASE/'owner/owner-key.json',BASE/'broker/evidence-key.json']:
  row=metadata(p);snapshots[str(p)]=row;immutable[str(p)]=row
 for p in [pathlib.Path('/etc/nyra-acceptance/target.json'),PRIVATE/'launch.json',BASE/'owner/source.json']:
  snapshots[str(p)]={'sha256':sha(file(p)),'metadata':metadata(p)}
 evidence={}
 for p in sorted((BASE/'coordinator/evidence').iterdir()):
  need(p.is_file() and not p.is_symlink(),'EVIDENCE_TYPE');evidence[p.name]=sha(file(p))
 immutable['historicalEvidence']=evidence
 db=json.loads(run('docker','inspect','nyra-repository-pg'))[0];net=json.loads(run('docker','network','inspect','nyra-repository-db'))[0]
 dbsafe={'id':db['Id'],'image':db['Image'],'networkId':net['Id'],'internal':net['Internal'],'labels':db['Config'].get('Labels',{}),'networkLabels':net.get('Labels',{}),'mounts':[{'type':m['Type'],'name':m.get('Name'),'destination':m['Destination'],'rw':m['RW']} for m in db['Mounts']]}
 immutable['database']=dbsafe
 query="begin read only;select json_build_object('roles',(select json_object_agg(rolname,to_char(rolvaliduntil at time zone 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"')) from pg_roles where rolname in ('nyra_accept_registrar','nyra_accept_broker')),'attributes',(select json_agg(json_build_object('name',rolname,'login',rolcanlogin,'super',rolsuper,'createRole',rolcreaterole,'createDB',rolcreatedb,'bypassRLS',rolbypassrls)) from pg_roles where rolname in ('nyra_accept_registrar','nyra_accept_broker')),'active',(select count(*) from nyra_trust.jobs where revoked_at is null and expires_at>clock_timestamp()),'jobs',(select count(*) from nyra_trust.jobs),'usedTokens',(select count(*) from nyra_trust.used_tokens));commit;"
 sql=json.loads(run('docker','exec','nyra-repository-pg','psql','-X','-qAt','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-c',query))
 schema=run('docker','exec','nyra-repository-pg','pg_dump','-U','postgres','--schema-only','--no-owner','--schema=nyra_trust','postgres');schema='\n'.join(x for x in schema.splitlines() if not x.startswith(('\\restrict','\\unrestrict')))
 immutable['schemaSHA256']=sha(schema.encode());immutable['roleAttributes']=sql['attributes'];immutable['historicalRows']={k:sql[k] for k in ['jobs','usedTokens']}
 bridge='br-'+net['Id'][:12]
 firewall=probe('iptables','-C','INPUT','-i',bridge,'-m','conntrack','--ctstate','NEW','-j','DROP') and probe('iptables','-C','DOCKER-USER','-i',bridge,'!','-o',bridge,'-j','DROP')
 unit='/etc/systemd/system/nyra-repository-expiry.timer';cleanup='/usr/local/sbin/nyra-repository-expire'
 calendar=run('systemctl','show','nyra-repository-expiry.timer','--property=TimersCalendar','--value');nexttime=run('systemctl','show','nyra-repository-expiry.timer','--property=NextElapseUSecRealtime','--value')
 next_dt=datetime.datetime.strptime(nexttime,'%a %Y-%m-%d %H:%M:%S %Z').replace(tzinfo=datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
 timer={'active':probe('systemctl','is-active','--quiet','nyra-repository-expiry.timer'),'enabled':probe('systemctl','is-enabled','--quiet','nyra-repository-expiry.timer'),'persistent':run('systemctl','show','nyra-repository-expiry.timer','--property=Persistent','--value')=='yes','deadline':target['expiresAt'] if '2026-11-04' in calendar and '21:05:00' in calendar else None,'nextTrigger':next_dt,'unitSHA256':sha(file(pathlib.Path(unit))),'cleanupSHA256':sha(file(pathlib.Path(cleanup)))}
 artifacts=[PRIVATE/'repository.lock',BASE/'coordinator/repository.json',BASE/'coordinator/role-ipc.json']+[BASE/r/n for r in ['registrar','broker'] for n in ['runtime.json','ipc.json']]
 attempts={}
 for p in sorted(pathlib.Path('/root/nyra-github-app').glob('stage3f-*')):
  attempts[p.name]={'metadata':metadata(p),'entries':{f.name:metadata(f) for f in p.iterdir()} if p.is_dir() and not p.is_symlink() else None}
 lease=json.loads(file(BASE/'coordinator/admin-read.json'))
 credentials={k:lease.get(k) for k in ['bootstrapId','appId','installationId','repositoryId','issuedAt','expiresAt','issuerExpiresAt']}
 credentials['expired']=min(datetime.datetime.fromisoformat(lease[k].replace('Z','+00:00')) for k in ['expiresAt','issuerExpiresAt'])<=datetime.datetime.now(datetime.timezone.utc)
 # No raw token, passwords, process argv, Docker Env, private key, VITE values,
 # cron contents or owner Auth identity enters this report.
 report={'schema':'nyra.acceptance.extension.inventory.v1','observedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'hostname':socket.gethostname(),'resourceId':target['resourceId'],'ipv4':target['ipv4'],'deadline':target['expiresAt'],'oldTargetSHA256':hashj(target),'newTargetSHA256':hashj(extended),'sourceSHA':run('git','--no-optional-locks','-C',str(ROOT),'rev-parse','HEAD'),'sourceClean':run('git','--no-optional-locks','-C',str(ROOT),'status','--porcelain','--untracked-files=all')=='','stagedCount':len(manifest),'stagedMatch':all(r['source']==r['live'] for r in staged.values()),'runtimeMismatches':{p:r for p,r in staged.items() if r['source']!=r['live']},'oldTimer':timer,'cleanupStarted':run('systemctl','show','nyra-repository-expiry.service','--property=ExecMainStartTimestamp','--value') not in ['','n/a'],'runtimeInactive':run('systemctl','show','nyra-repository-runtime.service','--property=ActiveState','--value')=='inactive','ownerInactive':run('systemctl','show','nyra-owner-source.service','--property=ActiveState','--value')=='inactive','liveRoleContainers':len(run('docker','ps','--filter','name=nyra-5c-live-','--format','{{.ID}}').splitlines()),'policyStateAbsent':not (BASE/'policy/state.json').exists(),'runtimeArtifactsAbsent':not any(p.exists() for p in artifacts),'extensionAttemptAbsent':not (PRIVATE/'extension-20261105-attempt').exists(),'activeRegistrations':sql['active'],'databasePreserved':db['State']['Running'],'databaseRoleAttributesSafe':len(sql['attributes'])==2 and all(r['login'] and not any(r[k] for k in ['super','createRole','createDB','bypassRLS']) for r in sql['attributes']),'databaseRoles':sql['roles'],'databaseTargetSHA256':db['Config'].get('Labels',{}).get('com.noctua.nyra.acceptance'),'networkTargetSHA256':net.get('Labels',{}).get('com.noctua.nyra.acceptance'),'networkInternal':net['Internal'],'publicDatabasePorts':len(db['HostConfig'].get('PortBindings') or {}),'firewallVerified':firewall,'providerIdentityVerified':False,'legacyDestructiveTimersAbsent':False,'providerAndAllScheduledTaskReview':'INDEPENDENT_AUTHENTICATED_REVIEW_REQUIRED','immutableInventorySHA256':hashj(immutable),'immutableInventory':immutable,'snapshots':snapshots,'privateRenewalAttemptInventory':attempts,'credentialMetadata':credentials,'authorization':False,'filesWritten':0,'networkRequests':0}
 print(json.dumps(report,sort_keys=True,indent=2))
if __name__=='__main__':
 try:main()
 except Exception as e:print(json.dumps({'status':'READ_ONLY_INVENTORY_CLOSED','reason':str(e) if isinstance(e,RuntimeError) else type(e).__name__,'authorization':False}),file=sys.stderr);sys.exit(1)
