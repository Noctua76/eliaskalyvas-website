// OFFLINE preparation only: no resource creation, key generation or dispatch.
import {readFile,writeFile,mkdir,copyFile,realpath} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {stageLiveRuntime} from './stage-live-runtime.mjs';
import {validateReplacementTarget} from './replacement-target.mjs';
import {hashJSON} from '../../lib/publication/contract.mjs';
const nodeImage='library/node@sha256:dd9d21971ec4395903fa6143c2b9267d048ae01ca6d3ea96f16cb30df6187d94';
const postgresImage='supabase/postgres@sha256:f371b5f3f2ac0a05703f33d6e6134515fb2498cab708fb948a0aeb7481467c00';
const digest=b=>createHash('sha256').update(b).digest('hex');
const need=(v,c)=>{if(!v)throw Error('OFFLINE_BOOTSTRAP_'+c);};
export function replacementCaddy(target,{acceptance=false}={}){
 validateReplacementTarget(target,{created:target.resourceId!==null});
 const host=new URL(target.origin).hostname;
 return `{\n    servers {\n        protocols h1 h2\n    }\n}\n${host} {\n    bind 0.0.0.0\n    request_body {\n        max_size 2B\n    }\n${acceptance?`    @ready {\n        method GET\n        path_regexp ready ^/ready/(build|inspection|publication)/[1-9][0-9]{0,19}/[1-9][0-9]{0,19}$\n    }\n    handle @ready {\n        reverse_proxy unix//run/nyra-5c/ingress.sock\n    }\n    @accept {\n        method POST\n        path /acceptance/build /acceptance/inspection /acceptance/publication\n    }\n    handle @accept {\n        reverse_proxy unix//run/nyra-5c/ingress.sock\n    }\n`:''}    handle {\n        respond "Not Found" 404\n    }\n}\n`;
}
export function mainAcceptanceBoundary({bootstrapHead,mainSHA,approvedPublicPlan=false}){
 need(/^[a-f0-9]{40}$/.test(bootstrapHead)&&/^[a-f0-9]{40}$/.test(mainSHA),'SOURCE');
 const reasons=[];if(bootstrapHead!==mainSHA)reasons.push('REVIEWED_BOOTSTRAP_NOT_ON_PROTECTED_MAIN');if(!approvedPublicPlan)reasons.push('LIVE_PUBLIC_PLAN_NOT_INSTALLED_ON_PROTECTED_MAIN');
 return {canAcceptPR26OnMain:reasons.length===0,reasons,dispatchAuthorized:false,publicationAuthorized:false};
}
export function renderUbuntuSetup(target,lock){
 validateReplacementTarget(target);need(['docker','caddy','ufw','iptables'].every(k=>/^[a-f0-9]{64}$/.test(lock[k]?.sha256)&&/^[A-Za-z0-9_.+-]+$/.test(lock[k]?.file)),'PREREQUISITES');
 const hashes=Object.values(lock).map(x=>x.sha256+'  vendor/'+x.file).join('\n');
 return `#!/bin/bash
# REVIEWED FUTURE HOST INSTALLER. Never run by preparation or CI.
set -euo pipefail
umask 077
test "\${1:-}" = --install-host
test "$(id -u)" = 0
test "$(sha256sum manifest.json | cut -d ' ' -f 1)" = "\${2:?reviewed manifest SHA256 required}"
cd -- "$(dirname -- "$0")"
python3 - <<'PY'
import json,os,stat,datetime,socket
expected=json.loads(${JSON.stringify(JSON.stringify(target))})
p='target.created.json';s=os.lstat(p)
assert stat.S_ISREG(s.st_mode) and not stat.S_ISLNK(s.st_mode) and s.st_uid==0 and s.st_nlink==1 and not s.st_mode&0o077
t=json.load(open(p)); projected=dict(t)
for k in ['resourceId','ipv4','createdAt','expiresAt']:projected[k]=None
assert projected==expected and t['resourceId'].isdigit() and t['ipv4']!='201.79.94.104'
import ipaddress
assert ipaddress.ip_address(t['ipv4']).is_global
start=datetime.datetime.fromisoformat(t['createdAt'].replace('Z','+00:00'));end=datetime.datetime.fromisoformat(t['expiresAt'].replace('Z','+00:00'));now=datetime.datetime.now(datetime.timezone.utc)
assert start<=now<end and 0<(end-start).total_seconds()<=86400
assert socket.gethostname()==t['hostname']
assert not any(os.path.exists(x) for x in ['/opt/nyra-5c/private','/var/lib/nyra-5c','/run/nyra-5c','/etc/nyra-acceptance'])
release=dict(x.strip().split('=',1) for x in open('/etc/os-release') if '=' in x)
assert release['ID'].strip('"')=='ubuntu' and release['VERSION_ID'].strip('"')=='24.04' and os.uname().machine=='x86_64'
PY
python3 - <<'PY'
import json,hashlib,pathlib,os
m=json.load(open('manifest.json'))
actual=list(pathlib.Path('runtime').rglob('*'))
assert not any(p.is_symlink() for p in actual)
assert {str(p.relative_to('runtime')) for p in actual if p.is_file()}==set(m['runtimeFiles'])
for name,sha in m['runtimeFiles'].items():
 p=pathlib.Path('runtime')/name
 assert p.is_file() and not p.is_symlink() and hashlib.sha256(p.read_bytes()).hexdigest()==sha
for name,sha in m['files'].items():
 assert hashlib.sha256(pathlib.Path(name).read_bytes()).hexdigest()==sha
PY
sha256sum --check --strict <<'SHA256'
${hashes}
SHA256
# No unpinned dependency download. An incompatible Ubuntu base fails closed.
apt-get --no-download --no-install-recommends -y install ./vendor/${lock.ufw.file} ./vendor/${lock.iptables.file}
test "$(dpkg-query -W -f='\${Version}' ufw)" = '${lock.ufw.version}'
test "$(dpkg-query -W -f='\${Version}' iptables)" = '${lock.iptables.version}'
tmp=$(mktemp -d)
trap 'rm -rf -- "$tmp"' EXIT
tar --no-same-owner -xzf vendor/${lock.docker.file} -C "$tmp"
for f in docker dockerd docker-init docker-proxy containerd ctr containerd-shim-runc-v2 runc; do install -m 0755 "$tmp/docker/$f" "/usr/local/bin/$f"; done
tar --no-same-owner -xzf vendor/${lock.caddy.file} -C "$tmp" caddy
install -m 0755 "$tmp/caddy" /usr/local/bin/caddy
cat > /etc/systemd/system/docker.service <<'UNIT'
[Unit]
After=network-online.target
[Service]
ExecStart=/usr/local/bin/dockerd --iptables=true --userland-proxy=false
Restart=on-failure
Delegate=yes
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now docker
docker pull ${nodeImage}
docker pull ${postgresImage}
nodecopy=$(docker create --network none ${nodeImage})
trap 'docker rm "$nodecopy" >/dev/null; rm -rf -- "$tmp"' EXIT
docker cp "$nodecopy:/usr/local/bin/node" "$tmp/node"
install -m 0755 "$tmp/node" /usr/local/bin/node
docker rm "$nodecopy" >/dev/null
trap 'rm -rf -- "$tmp"' EXIT
node --version
install -d -m 0755 /etc/nyra-acceptance
install -d -m 0700 /opt/nyra-5c/private
install -m 0600 target.created.json /etc/nyra-acceptance/target.json
cp -a runtime /opt/nyra-5c/live-runtime
chown -R root:root /opt/nyra-5c/live-runtime
chmod -R go-w /opt/nyra-5c/live-runtime
useradd --system --user-group --no-create-home --shell /usr/sbin/nologin nyra-caddy
install -d -m 0700 -o nyra-caddy -g nyra-caddy /var/lib/nyra-caddy
groupadd --system nyra-policy
groupadd --system nyra-ingress
groupadd --system nyra-receipts
for role in coordinator registrar broker owner; do
 useradd --system --user-group --no-create-home --shell /usr/sbin/nologin "nyra-$role"
 install -d -m 0700 -o "nyra-$role" -g "nyra-$role" "/var/lib/nyra-5c/$role"
done
usermod -a -G nyra-ingress nyra-caddy
usermod -a -G nyra-policy,nyra-ingress,nyra-receipts nyra-coordinator
install -d -m 0750 -o nyra-coordinator -g nyra-policy /var/lib/nyra-5c/policy
install -d -m 0750 -o nyra-coordinator -g nyra-ingress /run/nyra-5c
install -d -m 0750 -o nyra-owner -g nyra-receipts /run/nyra-owner-receipts
install -d -m 0700 -o nyra-coordinator -g nyra-coordinator /var/lib/nyra-5c/coordinator/evidence
install -m 0644 Caddyfile.disabled /etc/nyra-acceptance/Caddyfile
install -m 0644 caddy.service /etc/systemd/system/nyra-caddy.service
install -m 0644 runtime.service /etc/systemd/system/nyra-repository-runtime.service
install -m 0644 owner.service /etc/systemd/system/nyra-owner-source.service
ufw default deny incoming
ufw default allow outgoing
${target.operatorCIDRs.map(cidr=>'ufw allow from '+cidr+' to any port 22 proto tcp').join('\n')}
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
# These are root-owned COPY checkpoints, not mutable checkout references.
install -m 0700 expire.sh /usr/local/sbin/nyra-repository-expire
install -m 0644 expiry.service /etc/systemd/system/nyra-repository-expiry.service
python3 - <<'PY'
import json,datetime
x=json.load(open('target.created.json'));end=datetime.datetime.fromisoformat(x['expiresAt'].replace('Z','+00:00')).strftime('%Y-%m-%d %H:%M:%S UTC')
open('/etc/systemd/system/nyra-repository-expiry.timer','w').write('[Unit]\\nDescription=NYRA acceptance deadline\\n[Timer]\\nOnCalendar='+end+'\\nPersistent=true\\nUnit=nyra-repository-expiry.service\\n[Install]\\nWantedBy=timers.target\\n')
PY
systemctl daemon-reload
systemctl enable --now nyra-repository-expiry.timer
systemctl is-active --quiet nyra-repository-expiry.timer
printf '%s\\n' 'HOST_BASE_ONLY_NO_CREDENTIALS_NO_DISPATCH: perform provider-firewall/DNS/TLS preflight next'
`;
}
export async function prepareOfflineBootstrap({target,vendor,destination}){
 validateReplacementTarget(target);const source=await realpath(new URL('../../',import.meta.url).pathname),dest=resolve(destination);
 need(dest!==source&&!dest.startsWith(source+'/'),'OUTSIDE_CHECKOUT');await mkdir(dest,{mode:0o700});await mkdir(join(dest,'vendor'),{mode:0o700});
 const lock=JSON.parse(await readFile(new URL('./prerequisites.lock.json',import.meta.url)));for(const item of Object.values(lock)){const bytes=await readFile(join(vendor,item.file));need(digest(bytes)===item.sha256,'PREREQUISITE_HASH');await copyFile(join(vendor,item.file),join(dest,'vendor',item.file));}
 const files={
  'target.planned.json':JSON.stringify(target,null,2)+'\n','setup.sh':renderUbuntuSetup(target,lock),
  'Caddyfile.disabled':replacementCaddy(target),'Caddyfile.acceptance':replacementCaddy(target,{acceptance:true}),
  'proposed-main-public-plan.json':JSON.stringify({purpose:'isolated-live-trust-acceptance',approved:true,origin:target.origin+'/',publicEvidenceKeyId:'nyra-repository-evidence-'+target.bootstrapId},null,2)+'\n',
  'prerequisites.lock.json':JSON.stringify({...lock,node:{image:nodeImage},postgres:{image:postgresImage}},null,2)+'\n',
  'caddy.service':'[Unit]\nDescription=NYRA bounded acceptance HTTPS\nAfter=network-online.target\n[Service]\nUser=nyra-caddy\nGroup=nyra-caddy\nSupplementaryGroups=nyra-ingress\nEnvironment=XDG_DATA_HOME=/var/lib/nyra-caddy\nEnvironment=XDG_CONFIG_HOME=/var/lib/nyra-caddy\nExecStart=/usr/local/bin/caddy run --config /etc/nyra-acceptance/Caddyfile --adapter caddyfile\nAmbientCapabilities=CAP_NET_BIND_SERVICE\nCapabilityBoundingSet=CAP_NET_BIND_SERVICE\nNoNewPrivileges=true\nProtectSystem=strict\nProtectHome=true\nPrivateTmp=true\nReadWritePaths=/var/lib/nyra-caddy\n[Install]\nWantedBy=multi-user.target\n',
  'runtime.service':'[Unit]\nDescription=NYRA explicitly authorized private acceptance\nAfter=docker.service\nRequires=docker.service\n[Service]\nType=simple\nEnvironment=NYRA_REPOSITORY_LAUNCH=1\nExecStart=/usr/local/bin/node /opt/nyra-5c/live-runtime/ops/acceptance-bootstrap/repository-launch.mjs --run /opt/nyra-5c/private/launch.json\nTimeoutStopSec=15\nKillMode=control-group\nRestart=no\n',
  'owner.service':'[Unit]\nDescription=NYRA private existing owner MFA source\nAfter=network-online.target\n[Service]\nUser=nyra-owner\nGroup=nyra-owner\nSupplementaryGroups=nyra-receipts\nEnvironment=NYRA_ACCEPTANCE_OWNER_SOURCE=1\nExecStart=/usr/local/bin/node /opt/nyra-5c/live-runtime/ops/acceptance-bootstrap/owner-source.mjs /var/lib/nyra-5c/owner/source.json\nNoNewPrivileges=true\nProtectSystem=strict\nProtectHome=true\nReadWritePaths=/var/lib/nyra-5c/owner /run/nyra-owner-receipts\nRestart=no\n',
  'expiry.service':'[Unit]\nDescription=NYRA acceptance deadline cleanup\nAfter=docker.service\n[Service]\nType=oneshot\nExecStart=/usr/local/sbin/nyra-repository-expire\n',
  'expire.sh':`#!/bin/bash\nset -euo pipefail\n# Never calls provider API; this timer DOES NOT stop Droplet billing.\nfor unit in nyra-caddy.service nyra-repository-runtime.service nyra-owner-source.service; do if systemctl cat "$unit" >/dev/null 2>&1; then systemctl stop "$unit"; fi; done\n/usr/local/bin/node /opt/nyra-5c/live-runtime/ops/acceptance-bootstrap/repository-launch.mjs --cleanup /etc/nyra-acceptance/target.json\n# Preserve only the sanitized signed evidence directory for owner transfer.\nfor role in registrar broker owner coordinator; do for name in pg.json ipc.json evidence-key.json owner-key.json admin-read.json repository.json role-ipc.json; do rm -f -- "/var/lib/nyra-5c/$role/$name"; done; done\nrm -f /opt/nyra-5c/private/repository-db.env\nprintf '%s\\n' 'LOCAL_CLEANUP_COMPLETE_PROVIDER_DESTROY_STILL_REQUIRED'\n`
 };
 for(const [name,text]of Object.entries(files))await writeFile(join(dest,name),text,{flag:'wx',mode:name.endsWith('.sh')?0o700:0o600});
 execFileSync('bash',['-n',join(dest,'setup.sh')]);execFileSync('bash',['-n',join(dest,'expire.sh')]);
 await stageLiveRuntime({source,destination:join(dest,'runtime')});
 const runtimeFiles={};const walk=async(dir,prefix='')=>{const {readdir}=await import('node:fs/promises');for(const f of await readdir(dir,{withFileTypes:true})){const name=prefix+f.name;if(f.isDirectory())await walk(join(dir,f.name),name+'/');else {need(f.isFile(),'RUNTIME_SYMLINK');runtimeFiles[name]=digest(await readFile(join(dir,f.name)));}}};await walk(join(dest,'runtime'));
 const manifest={runtimeFiles,schema:'nyra.offline.bootstrap.v1',targetSHA256:hashJSON(target),files:Object.fromEntries(Object.entries(files).map(([p,t])=>[p,digest(t)])),vendor:Object.fromEntries(Object.values(lock).map(x=>[x.file,x.sha256])),images:{node:nodeImage,postgres:postgresImage},credentialsGenerated:0,resourcesCreated:0,liveAcceptance:false};
 await writeFile(join(dest,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx',mode:0o600});return manifest;
}
if(process.argv[1]===new URL(import.meta.url).pathname){try{need(process.argv[2]==='--prepare','MODE');console.log(JSON.stringify(await prepareOfflineBootstrap({target:JSON.parse(await readFile(process.argv[3],'utf8')),vendor:process.argv[4],destination:process.argv[5]}),null,2));}catch{console.error('OFFLINE_BOOTSTRAP_INCOMPLETE');process.exitCode=1;}}
