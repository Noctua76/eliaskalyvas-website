// Real isolated Docker acceptance: disposable CI resources only, no provider/host secrets.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {cleanupByDigest} from '../ops/acceptance-bootstrap/cleanup.mjs';
const native=process.env.NYRA_NATIVE_DOCKER==='1'&&process.platform==='linux';
const docker=args=>execFileSync('docker',args,{encoding:'utf8',timeout:30000,stdio:['ignore','pipe','pipe']}).trim();
test('native Docker exact-label retirement removes target container/network/volume, preserves unrelated resources',{skip:!native,timeout:90000},async()=>{
 // Random non-provider test scope; only resources created here can match.
 const digest=randomBytes(32).toString('hex'),label='com.noctua.nyra.acceptance='+digest;
 const suffix=randomBytes(8).toString('hex'),prefix='nyra-ci-'+suffix;
 const dir=await mkdtemp(join(tmpdir(),prefix+'-'));
 const target={container:prefix+'-target',network:prefix+'-net',volume:prefix+'-vol'};
 const control={container:prefix+'-control',network:prefix+'-control-net',volume:prefix+'-control-vol'};
 let image;
 try{
  await writeFile(join(dir,'sentinel.txt'),'NYRA_DISPOSABLE_NATIVE_CI\n');
  const archive=join(dir,'rootfs.tar');
  execFileSync('tar',['-C',dir,'--exclude=rootfs.tar','-cf',archive,'.'],{timeout:15000});
  image=docker(['import',archive]);
  assert.match(image,/^sha256:[a-f0-9]{64}$/);
  docker(['network','create','--label',label,target.network]);
  docker(['volume','create','--label',label,target.volume]);
  docker(['create','--name',target.container,'--label',label,'--mount','type=volume,dst=/nyra-ci-temporary',image,'/bin/true']);
  const anonymousVolume=JSON.parse(docker(['inspect',target.container]))[0].Mounts.find(x=>x.Type==='volume')?.Name;
  assert(anonymousVolume,'Expected temporary anonymous Docker volume');
  docker(['network','create',control.network]);
  docker(['volume','create',control.volume]);
  docker(['create','--name',control.container,image,'/bin/true']);
  const dry=cleanupByDigest(digest);assert.equal(dry.apply,false);
  assert.equal(dry.resources.length,3);
  const done=cleanupByDigest(digest,{apply:true});
  assert.equal(done.resources.length,3);
  assert.throws(()=>docker(['volume','inspect',anonymousVolume]),'Scoped anonymous volume survived container retirement');
  assert(done.resources.every(x=>x.removed===true));
  for(const [kind,name] of [['container',target.container],['network',target.network],['volume',target.volume]])
   assert.throws(()=>docker([kind,'inspect',name]));
  for(const [kind,name] of [['container',control.container],['network',control.network],['volume',control.volume]])
   assert.doesNotThrow(()=>docker([kind,'inspect',name]));
  assert.equal(done.manualRequired.some(x=>x.includes('provider Droplet')),true);
 }finally{
  for(const x of [target.container,control.container]){try{docker(['rm','-f',x]);}catch{}}
  for(const x of [target.network,control.network]){try{docker(['network','rm',x]);}catch{}}
  for(const x of [target.volume,control.volume]){try{docker(['volume','rm',x]);}catch{}}
  if(image)try{docker(['image','rm',image]);}catch{}
  await rm(dir,{recursive:true,force:true});
 }
});
