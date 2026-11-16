# Adapted only from the reviewed PR35 inactive alignment procedure.
# Explicit separately approved invocation only; imports never align a host.
import datetime, fcntl, hashlib, json, os, pathlib, re, stat, subprocess, sys
R='/opt/nyra-5c/bootstrap'; S=pathlib.Path('/opt/nyra-5c/live-runtime')
OLD='8b82cc964bdbc1919caf91c2669ca154204c025d'
HEAD='225b1bc946b5626e9105f24afd644467852a91af'
TREE='8fdac1689db7d0d2172481c4eb446bb20be18962'
NATIVE='ops/acceptance-bootstrap/repository-db-renewal.mjs'
NATIVE_SHA='376edf2bab73491141fce4be7e3c254250bd90891b169115b7c760723ff8d961'
NATIVES={NATIVE:NATIVE_SHA,'ops/acceptance-bootstrap/owner-request.mjs':'5d8b2189e5d229e44aa47fb6337ab36ad537c258b2f7ae022cc78aac75aa63f2'}
CHANGED=sorted([*NATIVES,'test/g08-owner-channel-diagnostics.test.mjs','test/g08-owner-commit-margin.test.mjs','test/nyra-bootstrap-native.test.mjs'])
TARGET_SHA='e02b1039eab7d7f46a3e6a29f69876fd2a8d703da4209e22ceac8d9c27508d1e'
URL='https://github.com/Noctua76/eliaskalyvas-website.git'
UNITS=['nyra-owner-source.service','nyra-repository-runtime.service','nyra-caddy.service']
changed=False; locks=[]
def need(ok,code):
    if not ok: raise RuntimeError(code)
def raw(*args):
    return subprocess.check_output(args,stderr=subprocess.DEVNULL,timeout=180)
def run(*args): return raw(*args).strip().decode()
def sha(b): return hashlib.sha256(b).hexdigest()
def secure_file(p):
    p=pathlib.Path(p); s=p.lstat()
    need(stat.S_ISREG(s.st_mode) and s.st_nlink==1 and s.st_uid==0 and s.st_gid==0 and not s.st_mode&0o022 and p.resolve()==p,'FILE_SECURITY')
    return p.read_bytes()
def inactive():
    for u in UNITS: need(run('systemctl','show',u,'--property=ActiveState','--value')=='inactive','SERVICE_NOT_INACTIVE')
    need(run('systemctl','is-active','nyra-repository-expiry.timer')=='active' and run('systemctl','is-enabled','nyra-repository-expiry.timer')=='enabled','FIXED_EXPIRY_TIMER')
    next_trigger=run('systemctl','show','nyra-repository-expiry.timer','--property=NextElapseUSecRealtime','--value')
    need(run('date','--utc','--date='+next_trigger,'+%s')=='1795375057','FIXED_EXPIRY_DEADLINE')
    need(run('systemctl','show','nyra-repository-expiry.timer','--property=Persistent','--value')=='yes' and run('systemctl','show','nyra-repository-expiry.timer','--property=AccuracyUSec','--value')=='1s','FIXED_EXPIRY_PROPERTIES')
def snapshot():
    result={}
    roots=['/opt/nyra-5c/private','/var/lib/nyra-5c','/var/lib/nyra-retirement','/etc/nyra-acceptance','/root/nyra-live-bootstrap/stage3g-tls-1d4b8e045a6ea25dd70f17ca1f17574f145820cbaf808e2ab74688cca9911f38']
    paths=[]
    for root in roots:
        p=pathlib.Path(root); need(p.is_dir() and not p.is_symlink(),'PRESERVED_DIRECTORY')
        paths.extend([p,*p.rglob('*')])
    paths.extend(pathlib.Path('/etc/systemd/system')/u for u in [*UNITS,'nyra-repository-expiry.timer','nyra-repository-expiry.service'])
    paths.append(pathlib.Path('/usr/local/sbin/nyra-repository-expire'))
    for p in paths:
        m=p.lstat(); value=sha(p.read_bytes()) if stat.S_ISREG(m.st_mode) else os.readlink(p) if stat.S_ISLNK(m.st_mode) else None
        result[str(p)]=(m.st_mode,m.st_uid,m.st_gid,m.st_nlink,value)
    return result

def validate_scope(data,approval,carry_approval,now=None):
    need(sha(data)==approval and re.fullmatch('[a-f0-9]{64}',approval or ''),'EXACT_ALIGNMENT_APPROVAL')
    s=json.loads(data)
    need(s['schema']=='nyra.stage3g.pr36.inactive-alignment.v1' and s['purpose']=='inactive-exact-source-and-two-runtime-modules' and re.fullmatch('[a-f0-9]{40}',s['sourceSHA']) and s['treeSHA']==TREE and s['parents']==[OLD,HEAD] and s['nativeSHA256']==NATIVES and s['targetSHA256']==TARGET_SHA and s['resourceId']=='617219249' and s['hostExpiresAt']=='2026-11-22T19:17:37Z','ALIGNMENT_SCOPE_PINS')
    need(s['carryForwardSHA256']==carry_approval and re.fullmatch('[a-f0-9]{64}',carry_approval or ''),'SEPARATE_TLS_CARRY_APPROVAL')
    need(all(s[k]==0 for k in ['configurationWrites','credentialOperations','serviceOperations','dispatches','providerMutations','automaticRetries']),'ALIGNMENT_OPERATION_SCOPE')
    now=now or datetime.datetime.now(datetime.timezone.utc)
    need(datetime.datetime.fromisoformat(s['notBefore'].replace('Z','+00:00'))<=now<datetime.datetime.fromisoformat(s['approvalNotAfter'].replace('Z','+00:00'))<=datetime.datetime.fromisoformat(s['hostExpiresAt'].replace('Z','+00:00')),'ALIGNMENT_APPROVAL_WINDOW')
    return s

def main(scope_path,approval,carry_approval):
    global changed,locks
    changed=False; locks=[]
    try:
        need(os.getuid()==0,'ROOT_REQUIRED')
        scope_path=pathlib.Path(scope_path).absolute(); scope=validate_scope(secure_file(scope_path),approval,carry_approval); NEW=scope['sourceSHA']
        for name,h in scope['helpers'].items():
            need(re.fullmatch('[A-Za-z0-9._-]+',name) and re.fullmatch('[a-f0-9]{64}',h),'HELPER_PATH')
            need(sha(secure_file(scope_path.parent/name))==h,'REVIEWED_HELPER_HASH')
        target=json.loads(secure_file('/etc/nyra-acceptance/target.json'))
        actual_target_hash=run('/usr/local/bin/node','--input-type=module','-e',"import{hashJSON}from'/opt/nyra-5c/live-runtime/lib/publication/contract.mjs';import{readFileSync}from'node:fs';process.stdout.write(hashJSON(JSON.parse(readFileSync('/etc/nyra-acceptance/target.json'))));")
        need(actual_target_hash==TARGET_SHA and target['resourceId']=='617219249' and target['ipv4']=='142.93.97.141' and run('hostname')==target['hostname']=='nyra-acceptance-20261108-01' and target['expiresAt']=='2026-11-22T19:17:37Z','IMMUTABLE_TARGET')
        need(datetime.datetime.now(datetime.timezone.utc)<datetime.datetime.fromisoformat(target['expiresAt'].replace('Z','+00:00')),'HOST_EXPIRED')
        for name in ['discovery-operator.lock','renewal.lock']:
            path='/opt/nyra-5c/private/'+name; secure_file(path)
            fd=os.open(path,os.O_RDWR|os.O_NOFOLLOW); locks.append(fd); fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
        inactive(); before=snapshot()
        current=run('git','-C',R,'rev-parse','HEAD')
        need(current in [OLD,NEW] and not run('git','-C',R,'status','--porcelain','--untracked-files=all'),'SOURCE_DRIFT')
        need(run('git','ls-remote',URL,'refs/heads/main').split()[0]==NEW,'REMOTE_MAIN_PIN')
        run('git','-C',R,'fetch','--no-tags',URL,NEW)
        need(run('git','-C',R,'rev-parse',NEW+'^{tree}')==TREE and run('git','-C',R,'show','-s','--format=%P',NEW)==OLD+' '+HEAD,'TREE_AND_PARENT_PINS')
        need(sorted(run('git','-C',R,'diff','--name-only',OLD,NEW).splitlines())==CHANGED,'SINGLE_NATIVE_FILE_SCOPE')
        manifest=secure_file(S/'runtime-files.json'); files=json.loads(manifest)
        need(isinstance(files,list) and len(files)==64 and len(set(files))==64 and NATIVE in files,'RUNTIME_MANIFEST')
        for name in files:
            need(isinstance(name,str) and re.fullmatch('[A-Za-z0-9._/-]+',name) and not name.startswith('/') and '..' not in pathlib.PurePosixPath(name).parts,'RUNTIME_PATH')
            b=secure_file(S/name); allowed=[raw('git','-C',R,'show',OLD+':'+name)]
            if name in NATIVES and current==NEW: allowed.append(raw('git','-C',R,'show',NEW+':'+name))
            need(b in allowed,'STAGED_RUNTIME_DRIFT')
        replacements={name:raw('git','-C',R,'show',NEW+':'+name) for name in NATIVES}
        need(all(sha(replacements[n])==h for n,h in NATIVES.items()),'NATIVE_BYTES')
        expected=json.loads(secure_file(scope_path.parent/'runtime-inventory.json'))
        need(set(expected)==set(files) and all(sha(raw('git','-C',R,'show',NEW+':'+n))==expected[n] for n in files),'EXACT_64_FILE_INVENTORY')
        historical=json.loads(raw('/usr/local/bin/node',str(scope_path.parent/'tls-carry-forward.mjs'),'--historical','1cba3ff58a7a0d3fb588f3c23f0cde0b14aecc9c13ff18457b00f21c7f05e364'))
        need(historical['status']=='PASS' and historical['historicalSourceSHA']=='2779edc75c13b66246957b9ca0aa996d764901bc','HISTORICAL_TLS_CHECKPOINT')
        validate_scope(secure_file(scope_path),approval,carry_approval)
        inactive(); need(snapshot()==before,'PRIVATE_STATE_DRIFT')
        if current!=NEW:
            changed=True; run('git','-C',R,'checkout','--detach',NEW)
        for native,replacement in replacements.items():
            dst=S/native
            if secure_file(dst)!=replacement:
                validate_scope(secure_file(scope_path),approval,carry_approval)
                changed=True; metadata=dst.lstat(); tmp=dst.with_name(dst.name+'.pr35-'+NATIVE_SHA[:16])
                fd=os.open(tmp,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,stat.S_IMODE(metadata.st_mode))
                with os.fdopen(fd,'wb') as f:
                    f.write(replacement); f.flush(); os.fchmod(f.fileno(),stat.S_IMODE(metadata.st_mode)); os.fsync(f.fileno())
                os.replace(tmp,dst); d=os.open(dst.parent,os.O_RDONLY|os.O_DIRECTORY)
                try: os.fsync(d)
                finally: os.close(d)
        need(run('git','-C',R,'rev-parse','HEAD')==NEW and not run('git','-C',R,'status','--porcelain','--untracked-files=all'),'FINAL_SOURCE_PIN')
        for name in files: need(secure_file(S/name)==raw('git','-C',R,'show',NEW+':'+name),'FINAL_RUNTIME_PIN')
        need(secure_file(S/'runtime-files.json')==manifest and snapshot()==before,'PRESERVED_STATE_CHANGED')
        inactive(); need(run('git','ls-remote',URL,'refs/heads/main').split()[0]==NEW,'REMOTE_MAIN_MOVED')
        carry=json.loads(raw('/usr/local/bin/node',str(scope_path.parent/'pr36-tls-carry.mjs'),'--verify',carry_approval))
        need(carry['status']=='PASS' and carry['sourceSHA']==NEW and carry['carryForwardSHA256']==carry_approval,'TLS_SOURCE_CARRY_FORWARD')
        need(snapshot()==before,'POST_CARRY_PRIVATE_STATE_CHANGED')
        print(json.dumps({'scopeSHA256':approval,'tlsCarryForward':carry,'marker':'NYRA_PR36_INACTIVE_SOURCE_ALIGNMENT_PASS','sourceSHA':NEW,'treeSHA':TREE,'nativeSHA256':NATIVES,'stagedFilesVerified':64,'privateStateUnchanged':True,'configurationInstalled':False,'servicesActivated':False,'configurationRolloverRequired':True,'sourceChanged':changed}))
    except Exception as e:
        print(json.dumps({'marker':'NYRA_PR36_SOURCE_ALIGNMENT_STOP','code':str(e) if isinstance(e,RuntimeError) else 'ALIGNMENT_FAILED','sourceMayHaveChanged':changed,'automaticRollback':False,'servicesActivatedByProcedure':False}))
        return 1
    finally:
        for fd in locks: os.close(fd)
    return 0

if __name__=='__main__':
    if len(sys.argv)!=4:
        print('{"marker":"NYRA_PR35_SOURCE_ALIGNMENT_STOP","code":"EXACT_ARGUMENTS_REQUIRED"}'); sys.exit(1)
    sys.exit(main(*sys.argv[1:]))
