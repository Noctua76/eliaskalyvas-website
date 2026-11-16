import assert from 'node:assert/strict';
import {generateKeyPairSync,createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {protect,unprotect,verifySHA256} from './envelope.mjs';

const [input,output] = process.argv.slice(2), checks=[];
function check(name, operation) { operation(); checks.push({name,status:'PASS'}); }
function reject(name, operation) { check(name,()=>assert.throws(operation)); }
function clone(x) { return JSON.parse(JSON.stringify(x)); }
function flip(e,field) { const v=clone(e),b=Buffer.from(v[field],'base64'); b[0]^=1;
  v[field]=b.toString('base64'); return v; }
let fixture;
try {
  assert(input && output); assert.equal(process.platform,'win32');
  assert.equal(Number(process.versions.node.split('.')[0]),22);
  mkdirSync(output,{recursive:false});
  fixture=readFileSync(input);
  check('synthetic-real-zip',()=>assert(fixture.subarray(0,4).equals(Buffer.from([80,75,3,4]))));
  const pair=generateKeyPairSync('rsa',{modulusLength:3072});
  const wrong=generateKeyPairSync('rsa',{modulusLength:3072});
  const weak=generateKeyPairSync('rsa',{modulusLength:2048});
  const envelope=protect(fixture,pair.publicKey), digest=createHash('sha256').update(fixture).digest('hex');
  let plain;
  try {
    plain=unprotect(envelope,pair.privateKey);
    check('authenticated-roundtrip',()=>assert(plain.equals(fixture)));
    check('exact-input-sha256',()=>verifySHA256(plain,digest));
    reject('wrong-input-sha256',()=>verifySHA256(plain,'0'.repeat(64)));
  } finally { plain?.fill(0); }
  check('fresh-key-and-nonce',()=>assert.notDeepEqual(protect(fixture,pair.publicKey),envelope));
  for(const field of ['ciphertext','tag','iv','wrappedKey'])
    reject('reject-tampered-'+field,()=>unprotect(flip(envelope,field),pair.privateKey));
  reject('wrong-recipient-private-key',()=>unprotect(envelope,wrong.privateKey));
  reject('weak-rsa-recipient',()=>protect(fixture,weak.publicKey));
  reject('empty-plaintext',()=>protect(Buffer.alloc(0),pair.publicKey));
  let changed=clone(envelope);changed.schema='other';
  reject('schema-substitution',()=>unprotect(changed,pair.privateKey));
  changed=clone(envelope);changed.algorithm='none';
  reject('algorithm-substitution',()=>unprotect(changed,pair.privateKey));
  changed=clone(envelope);changed.recipientSHA256='0'.repeat(64);
  reject('recipient-binding-substitution',()=>unprotect(changed,pair.privateKey));
  changed=clone(envelope);changed.extra='unexpected';
  reject('unexpected-envelope-field',()=>unprotect(changed,pair.privateKey));
  changed=clone(envelope);delete changed.tag;
  reject('missing-tag',()=>unprotect(changed,pair.privateKey));
  changed=clone(envelope);changed.iv='!!!!';
  reject('invalid-base64',()=>unprotect(changed,pair.privateKey));
  changed=clone(envelope);changed.tag=Buffer.alloc(8).toString('base64');
  reject('truncated-tag',()=>unprotect(changed,pair.privateKey));
  const encrypted=JSON.stringify(envelope)+'\n';
  writeFileSync(join(output,'synthetic.enc.json'),encrypted,{encoding:'utf8',flag:'wx'});
  const proof={schema:'nyra.synthetic-transfer-proof.v1',status:'PASS',syntheticOnly:true,
    realPrivateInputTransferred:false,recipientPrivateKeyExported:false,decryptionKeyPersisted:false,
    encryptedPackageSHA256:createHash('sha256').update(encrypted).digest('hex'),
    node:process.version,platform:process.platform,headSHA:process.env.GITHUB_SHA,
    checks,plaintextFilesRemoved:false};
  writeFileSync(join(output,'proof.json'),JSON.stringify(proof,null,2)+'\n',{encoding:'utf8',flag:'wx'});
  assert.deepEqual(readdirSync(output).sort(),['proof.json','synthetic.enc.json']);
  console.log(JSON.stringify({marker:'NYRA_SYNTHETIC_TRANSFER_PASS',checks:checks.length,
    encryptedPackageSHA256:proof.encryptedPackageSHA256,realPrivateInputTransferred:false}));
} catch(error) {
  console.error('NYRA_SYNTHETIC_TRANSFER_STOP '+(error.code || error.name || 'ERROR'));
  process.exitCode=1;
} finally { fixture?.fill(0); }
