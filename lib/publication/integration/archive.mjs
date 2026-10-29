// Private Node/Deno-compatible archive inspection. Never extracts untrusted paths.
import {inflateRawSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {artifactSealer} from '../runtime/artifact.mjs';
import {requireDelivery as need} from '../runtime/materialize.mjs';
export const MAX_ARCHIVE_BYTES=128*1024*1024;
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const validPath=p=>typeof p==='string'&&Buffer.byteLength(p)<=100&&!p.startsWith('/')&&!p.split('/').some(s=>!s||s==='.'||s==='..')&&!/[\\\x00-\x1f]/.test(p);
const crc32=b=>{let c=0xffffffff;for(const n of b){c^=n;for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;};
const octal=(b,start,size)=>{const s=b.subarray(start,start+size).toString('ascii').replace(/\0.*$/s,'').trim();need(/^[0-7]+$/.test(s),'TAR_NUMBER');return Number.parseInt(s,8);};
export function createPagesTar(files){
 need(files instanceof Map&&files.size>0,'BUILD_FILES_REQUIRED');const chunks=[];let total=1024;
 for(const [path,input]of [...files].sort(([a],[b])=>a<b?-1:a>b?1:0)){
  need(validPath(path)&&input instanceof Uint8Array,'TAR_PATH');const bytes=Buffer.from(input),h=Buffer.alloc(512);
  h.write(path,0,100,'utf8');for(const [at,n,size]of [[100,0o644,8],[108,0,8],[116,0,8],[124,bytes.length,12],[136,0,12]])h.write(n.toString(8).padStart(size-1,'0')+'\0',at,size,'ascii');
  h.fill(32,148,156);h[156]=48;h.write('ustar\0',257,6);h.write('00',263,2);const sum=h.reduce((a,b)=>a+b,0);h.write(sum.toString(8).padStart(6,'0')+'\0 ',148,8);
  const pad=Buffer.alloc((512-bytes.length%512)%512);total+=512+bytes.length+pad.length;need(total<=MAX_ARCHIVE_BYTES,'ARCHIVE_SIZE');chunks.push(h,bytes,pad);
 }return Buffer.concat([...chunks,Buffer.alloc(1024)]);
}
export function readPagesTar(input){
 const bytes=Buffer.from(input);need(bytes.length<=MAX_ARCHIVE_BYTES&&bytes.length%512===0,'TAR_SIZE');const files=new Map();let at=0,ended=false;
 while(at+512<=bytes.length){const h=bytes.subarray(at,at+512);if(h.every(x=>x===0)){need(at+1024<=bytes.length&&bytes.subarray(at).every(x=>x===0),'TAR_END');ended=true;break;}
  const expected=octal(h,148,8),copy=Buffer.from(h);copy.fill(32,148,156);need(copy.reduce((a,b)=>a+b,0)===expected,'TAR_CHECKSUM');
  const path=h.subarray(0,100).toString('utf8').replace(/\0.*$/s,'');need(validPath(path)&&!files.has(path)&&[0,48].includes(h[156])&&h.subarray(345,500).every(x=>x===0),'TAR_ENTRY');
  need(h.subarray(257,263).toString()==='ustar\0','TAR_FORMAT');const size=octal(h,124,12);at+=512;need(at+size<=bytes.length,'TAR_TRUNCATED');files.set(path,new Uint8Array(bytes.subarray(at,at+size)));at+=Math.ceil(size/512)*512;
 }need(ended&&files.size>0,'TAR_END');return files;
}
// GitHub upload-artifact v4 ZIP containing exactly our artifact.tar. Unsupported
// encryption, ZIP64, duplicate/extra entries and zip bombs fail closed.
export function readGitHubArtifactZip(input){
 const zip=Buffer.from(input);need(zip.length<=MAX_ARCHIVE_BYTES&&zip.length>=22,'ZIP_SIZE');let end=-1;
 for(let i=zip.length-22;i>=Math.max(0,zip.length-65557);i--)if(zip.readUInt32LE(i)===0x06054b50&&i+22+zip.readUInt16LE(i+20)===zip.length){end=i;break;}
 need(end>=0,'ZIP_DIRECTORY');need(zip.readUInt16LE(end+4)===0&&zip.readUInt16LE(end+6)===0&&zip.readUInt16LE(end+8)===1&&zip.readUInt16LE(end+10)===1,'ZIP_ENTRIES');
 const size=zip.readUInt32LE(end+12),at=zip.readUInt32LE(end+16);need(at+size===end&&zip.readUInt32LE(at)===0x02014b50,'ZIP_DIRECTORY');
 const flags=zip.readUInt16LE(at+8),method=zip.readUInt16LE(at+10),crc=zip.readUInt32LE(at+16),compressed=zip.readUInt32LE(at+20),expanded=zip.readUInt32LE(at+24),n=zip.readUInt16LE(at+28),extra=zip.readUInt16LE(at+30),comment=zip.readUInt16LE(at+32),local=zip.readUInt32LE(at+42);
 need((flags&~0x808)===0&&[0,8].includes(method)&&expanded<=MAX_ARCHIVE_BYTES&&compressed!==0xffffffff&&expanded!==0xffffffff&&local===0,'ZIP_UNSUPPORTED');
 need(46+n+extra+comment===size&&zip.subarray(at+46,at+46+n).toString()==='artifact.tar','ZIP_ENTRY');
 need(zip.readUInt32LE(0)===0x04034b50&&zip.readUInt16LE(6)===flags&&zip.readUInt16LE(8)===method,'ZIP_LOCAL');const ln=zip.readUInt16LE(26),le=zip.readUInt16LE(28),start=30+ln+le;
 need(zip.subarray(30,30+ln).toString()==='artifact.tar'&&start+compressed<=at,'ZIP_LOCAL');const packed=zip.subarray(start,start+compressed),tar=method===0?packed:inflateRawSync(packed,{maxOutputLength:MAX_ARCHIVE_BYTES});
 need(tar.length===expanded&&crc32(tar)===crc,'ZIP_INTEGRITY');return new Uint8Array(tar);
}
export function artifactProvenanceVerifier({github,validateFiles}){
 const known=new WeakMap();return Object.freeze({
  async verify(attempt,candidate){
   const {artifact,archive}=await github.artifactFor(attempt,candidate.storedProvenance?.github_artifact_id);need(artifact?.name==='github-pages'&&String(artifact.workflow_run?.id)===attempt.runId&&artifact.workflow_run?.head_sha===attempt.codeSHA&&!artifact.expired&&/^[1-9][0-9]*$/.test(String(artifact.id)),'ARTIFACT_RUN');
   need(/^sha256:[a-f0-9]{64}$/.test(artifact.digest)&&sha256(archive)===artifact.digest.slice(7),'ARTIFACT_ZIP_DIGEST');
   const tar=readGitHubArtifactZip(archive),files=readPagesTar(tar);await validateFiles(files,{attempt,candidate});
   const sealer=artifactSealer(),seal=sealer.seal(files,{candidateId:candidate.id,attemptId:attempt.id,fence:attempt.fence,codeSHA:attempt.codeSHA,manifestSHA256:candidate.manifestSHA256});
   const proof=Object.freeze({...seal,artifactId:String(artifact.id),zipSHA256:sha256(archive),tarSHA256:sha256(tar)});known.set(proof,sealer.files(seal));return proof;
  },
  assert(proof){need(known.has(proof),'UNVERIFIED_ARTIFACT_PROVENANCE');return proof;},
  files(proof){need(known.has(proof),'UNVERIFIED_ARTIFACT_PROVENANCE');return new Map([...known.get(proof)].map(([p,b])=>[p,new Uint8Array(b)]));}
 });
}
