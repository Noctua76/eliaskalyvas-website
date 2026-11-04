#!/usr/bin/env python3
"""Exactly two approved-byte replacements, separately approved; no deployment.
Default --preflight is read-only. --apply requires the exact reviewed context,
root, isolated network namespace, inactive services/processes and one new attempt.
No cleanup, rollback, token handling, provisioning or broader runtime copy.
"""
import os,sys,json,hashlib,pathlib,stat,subprocess,socket,datetime
SOURCE='29a73458d4cd941e5ed514db56dc2c553d041bda'
OLD='2026-11-04T21:05:00Z'
BEFORE={'lib/publication/runtime/protected-identity.mjs':'bc9f4e709814fb9f18b274779750fc4c930c2f0fadf5600f5515633a72219072','ops/acceptance-bootstrap/replacement-target.mjs':'7e7c6694d331a7865f471fb9f24908c632c47c080106537c3799a911f6454587'}
AFTER={'lib/publication/runtime/protected-identity.mjs':'a4dcc7fd2963c4ea4e3f1fab586ddad5dc0baddcc20b55bc0888329cc3151054','ops/acceptance-bootstrap/replacement-target.mjs':'f6a148a6604b1fd506b44e558c6f26b7b2ca98321bff9add8009cd5627e33f5e'}
ROOT=pathlib.Path('/opt/nyra-5c/bootstrap');CAND=pathlib.Path('/opt/nyra-5c/stage3-candidate-29a73458/runtime');LIVE=pathlib.Path('/opt/nyra-5c/live-runtime');ATTEMPT=pathlib.Path('/root/nyra-github-app/runtime-align-29a73458-once')
def need(v,c):
 if not v:raise RuntimeError(c)
def sha(b):return hashlib.sha256(b).hexdigest()
def digest(v):return sha(json.dumps(v,sort_keys=True,separators=(',',':')).encode())
def meta(p):
 s=p.lstat();return dict(dev=s.st_dev,ino=s.st_ino,uid=s.st_uid,gid=s.st_gid,mode=stat.S_IMODE(s.st_mode),nlink=s.st_nlink,size=s.st_size,mtimeNs=s.st_mtime_ns,ctimeNs=s.st_ctime_ns)
def secure(p,mode=None):
 s=p.lstat();need(p.resolve()==p and stat.S_ISREG(s.st_mode) and s.st_uid==0 and s.st_nlink==1 and s.st_mode&0o022==0,'FILE_METADATA')
 if mode is not None:need(stat.S_IMODE(s.st_mode)==mode,'FILE_MODE')
 return p.read_bytes()
def run(*a):return subprocess.check_output(a,text=True,stderr=subprocess.DEVNULL,env={'PATH':os.environ['PATH'],'GIT_OPTIONAL_LOCKS':'0'}).strip()
def inspect(source,candidate,live,files,read=secure):
 need(len(files)==57 and len(set(files))==57 and all(isinstance(f,str) and not f.startswith('/') and '..' not in pathlib.PurePosixPath(f).parts for f in files),'MANIFEST_57')
 rows={};mismatch=[]
 for f in files:
  sb=read(source/f);cb=read(candidate/f);lb=read(live/f)
  need(sb==cb,'CANDIDATE_SOURCE_BYTES');rows[f]={'source':sha(sb),'candidate':sha(cb),'live':sha(lb),'liveMetadata':meta(live/f)}
  if lb!=sb:mismatch.append(f)
 need(sorted(mismatch)==sorted(BEFORE),'EXACT_TWO_MISMATCHES_REQUIRED')
 for f in BEFORE:need(rows[f]['source']==AFTER[f] and rows[f]['live']==BEFORE[f],'UNREVIEWED_OR_NEWER_RUNTIME_BYTES_STOP')
 return rows
def guard():
 need(os.geteuid()==0 and socket.gethostname()=='nyra-acceptance-20261102-01','HOST_ROOT')
 t=json.loads(secure(pathlib.Path('/etc/nyra-acceptance/target.json'),0o600));need(t['bootstrapId']=='nyra-acceptance-20261102-01' and t['hostname']==socket.gethostname() and t['resourceId']=='615221104' and t['ipv4']=='139.59.136.219' and t['origin']=='https://nyra-acceptance.eliaskalyvas.gr' and t['createdAt']=='2026-11-02T21:06:46Z' and t['expiresAt']==OLD and t['authorization'] is False,'EXACT_OLD_TARGET')
 now=datetime.datetime.now(datetime.timezone.utc);need(now<datetime.datetime(2026,11,4,21,5,tzinfo=datetime.timezone.utc),'ORIGINAL_WINDOW_ENDED')
 need(run('systemctl','is-active','nyra-repository-expiry.timer')=='active','OLD_EXPIRY_REQUIRED')
 calendar=run('systemctl','show','nyra-repository-expiry.timer','--property=TimersCalendar','--value');need('2026-11-04' in calendar and '21:05:00' in calendar,'OLD_TIMER_CALENDAR')
 for unit in ['nyra-owner-source.service','nyra-repository-runtime.service']:
  r=subprocess.run(['systemctl','is-active',unit],text=True,capture_output=True);need(r.stdout.strip()=='inactive' and r.returncode==3,'ACTIVE_OR_FAILED_SERVICE_STOP')
 need(run('docker','ps','--filter','name=nyra-5c-live-','--format','{{.Names}}')=='','ACTIVE_ROLE_CONTAINER')
 # Node imports may remain in memory even after file descriptors close. Refuse
 # unmanaged processes referencing the acceptance paths; never kill/restart them.
 for proc in pathlib.Path('/proc').iterdir():
  if not proc.name.isdigit() or int(proc.name)==os.getpid():continue
  try:cmd=(proc/'cmdline').read_bytes().replace(b'\0',b' ')
  except (FileNotFoundError,ProcessLookupError):continue
  if (b'node' in cmd or b'live-role-worker' in cmd) and (b'/opt/nyra-5c/' in cmd or b'/var/lib/nyra-5c/' in cmd):raise RuntimeError('UNMANAGED_IMPORTED_RUNTIME_PROCESS')
 for p in ['/opt/nyra-5c/private/repository.lock','/var/lib/nyra-5c/policy/state.json']:
  need(not pathlib.Path(p).exists(),'ACTIVE_RUNTIME_ARTIFACT')
 need(run('git','--no-optional-locks','-C',str(ROOT),'rev-parse','HEAD')==SOURCE and run('git','--no-optional-locks','-C',str(ROOT),'status','--porcelain','--untracked-files=all')=='','EXACT_CLEAN_SOURCE')
 return t,calendar
def preflight():
 t,calendar=guard();parent=ATTEMPT.parent;s=parent.lstat();need(parent.resolve()==parent and stat.S_ISDIR(s.st_mode) and s.st_uid==0 and s.st_mode&0o077==0,'PRIVATE_ATTEMPT_DIRECTORY')
 need(not ATTEMPT.exists() and not ATTEMPT.is_symlink(),'ATTEMPT_EXISTS_INDEPENDENT_RECOVERY')
 files=json.loads(secure(LIVE/'runtime-files.json'));need(files==json.loads(secure(CAND/'runtime-files.json')),'MANIFEST_CHANGED')
 rows=inspect(ROOT,CAND,LIVE,files)
 for f in BEFORE:need(meta(LIVE/f)['dev']==ATTEMPT.parent.stat().st_dev,'SAME_FILESYSTEM_REQUIRED')
 immutable={}
 for p in ['/opt/nyra-5c/private/launch.json','/opt/nyra-5c/private/stage3-reviewed-input.json','/opt/nyra-5c/private/stage3-provisioning-attempt.json','/etc/nyra-acceptance/target.json']:
  path=pathlib.Path(p);immutable[p]={'sha256':sha(secure(path,0o600)),'metadata':meta(path)}
 context={'sourceSHA':SOURCE,'rows':rows,'immutable':immutable,'targetSHA256':digest(t),'timer':calendar,'helperSHA256':sha(pathlib.Path(__file__).read_bytes())}
 return context,digest(context),files

def write_exclusive(p,b,mode=0o600):
 fd=os.open(p,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,mode)
 os.fchmod(fd,mode)
 with os.fdopen(fd,'wb') as out:out.write(b);out.flush();os.fsync(out.fileno())
def sync(p):
 fd=os.open(p,os.O_RDONLY|os.O_DIRECTORY)
 try:os.fsync(fd)
 finally:os.close(fd)
def apply(context,expected,files):
 need(os.readlink('/proc/self/ns/net')!=os.readlink('/proc/1/ns/net'),'NETWORK_NAMESPACE_REQUIRED')
 fresh,actual,_=preflight();need(actual==expected and fresh==context,'CONTEXT_CHANGED')
 ATTEMPT.mkdir(mode=0o700);sync(ATTEMPT.parent);write_exclusive(ATTEMPT/'00-reserved.json',(json.dumps(context,sort_keys=True)+'\n').encode());sync(ATTEMPT)
 # No automatic recovery after this durable reservation, including partial pair.
 for i,f in enumerate(sorted(BEFORE)):
  guard();p=LIVE/f;need(meta(p)==context['rows'][f]['liveMetadata'] and sha(secure(p))==BEFORE[f],'CONCURRENT_RUNTIME_CHANGE')
  b=secure(CAND/f);need(sha(b)==AFTER[f],'CANDIDATE_CHANGED')
  pending=p.parent/(p.name+'.alignment-pending-29a73458');write_exclusive(pending,b,context['rows'][f]['liveMetadata']['mode']);sync(p.parent)
  archive=ATTEMPT/('previous-'+str(i)+'.mjs');need(not archive.exists(),'ARCHIVE_EXISTS')
  os.rename(p,archive);sync(p.parent);sync(ATTEMPT)
  need(sha(secure(archive))==BEFORE[f] and meta(archive)['ino']==context['rows'][f]['liveMetadata']['ino'],'DISPLACED_FILE_CHANGED')
  os.link(pending,p);sync(p.parent);pending.unlink();sync(p.parent)
  need(sha(secure(p))==AFTER[f],'INSTALL_BYTES')
 guard()
 for f in files:need(secure(ROOT/f)==secure(CAND/f)==secure(LIVE/f),'FINAL_57_BYTES')
 for p,old in context['immutable'].items():need(sha(secure(pathlib.Path(p),0o600))==old['sha256'] and meta(pathlib.Path(p))==old['metadata'],'IMMUTABLE_CHANGED')
 result={'status':'RUNTIME_ALIGNED_57_OF_57_NO_AUTHORIZATION','sourceSHA':SOURCE,'filesReplaced':sorted(BEFORE),'contextSHA256':expected,'authorization':False,'keysGenerated':0,'dispatches':0,'credentialsIssued':0}
 write_exclusive(ATTEMPT/'40-complete.json',(json.dumps(result)+'\n').encode());sync(ATTEMPT);return result

def main():
 os.umask(0o077);a=sys.argv[1:]
 need(a==['--preflight'] or (len(a)==3 and a[0]=='--apply' and a[2]=='--owner-approved' and len(a[1])==64 and all(c in '0123456789abcdef' for c in a[1])),'USAGE')
 context,pin,files=preflight()
 if a==['--preflight']:
  print(json.dumps({'status':'ALIGNMENT_REVIEW_REQUIRED','sourceSHA':SOURCE,'candidateMatches':57,'liveMatches':55,'replacements':{f:{'before':BEFORE[f],'after':AFTER[f]} for f in BEFORE},'contextSHA256':pin,'helperSHA256':context['helperSHA256'],'hostDeadline':OLD,'networkRequests':0,'authorization':False}));return
 # A flag is not Owner/MFA evidence. This exact command needs prior explicit
 # operational approval of the helper/context and pair, recorded independently.
 need(a[1]==pin,'APPROVED_CONTEXT_MISMATCH');print(json.dumps(apply(context,pin,files)))
if __name__=='__main__':
 try:main()
 except Exception as e:
  reason=str(e) if isinstance(e,RuntimeError) else type(e).__name__
  print(json.dumps({'status':'ALIGNMENT_CLOSED_INDEPENDENT_RECOVERY_REQUIRED','reason':reason,'authorization':False}),file=sys.stderr);sys.exit(1)
