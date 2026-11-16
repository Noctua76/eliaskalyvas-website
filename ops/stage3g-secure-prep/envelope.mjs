import { randomBytes, createHash, createCipheriv, createDecipheriv, publicEncrypt,
  privateDecrypt, createPublicKey, constants, timingSafeEqual } from 'node:crypto';

const SCHEMA = 'nyra.encrypted-package.v1';
const ALGORITHM = 'RSA-OAEP-256+A256GCM';
const MAX_BYTES = 16 * 1024 * 1024;
const FIELDS = ['algorithm','ciphertext','iv','recipientSHA256','schema','tag','wrappedKey'];
function requireValue(ok, code) { if (!ok) throw new Error(code); }
function publicPart(key) { return key?.type === 'public' ? key : createPublicKey(key); }
function checkKey(key) {
  requireValue(key?.asymmetricKeyType === 'rsa', 'RSA_KEY_REQUIRED');
  const bits = key.asymmetricKeyDetails?.modulusLength;
  requireValue(bits >= 3072 && bits <= 8192, 'RSA_KEY_SIZE');
}
function recipientHash(key) {
  const pub = publicPart(key); checkKey(pub);
  return createHash('sha256').update(pub.export({type:'spki',format:'der'})).digest('hex');
}
function decode(value, maximum, exact) {
  requireValue(typeof value === 'string' && value.length <= Math.ceil(maximum / 3) * 4,
    'ENVELOPE_ENCODING_BOUND');
  requireValue(/^[A-Za-z0-9+/]*={0,2}$/.test(value), 'ENVELOPE_ENCODING');
  const bytes = Buffer.from(value, 'base64');
  requireValue(bytes.toString('base64') === value && bytes.length <= maximum &&
    (exact === undefined || bytes.length === exact), 'ENVELOPE_ENCODING');
  return bytes;
}
function aad(e) {
  return Buffer.from(JSON.stringify({schema:e.schema,algorithm:e.algorithm,
    recipientSHA256:e.recipientSHA256,wrappedKey:e.wrappedKey}), 'utf8');
}
export function verifySHA256(bytes, expected) {
  requireValue(typeof expected === 'string' && /^[a-f0-9]{64}$/.test(expected), 'DIGEST_FORMAT');
  requireValue(timingSafeEqual(createHash('sha256').update(bytes).digest(),
    Buffer.from(expected,'hex')), 'DIGEST_MISMATCH');
}
export function protect(plaintext, recipientPublicKey) {
  requireValue(Buffer.isBuffer(plaintext) && plaintext.length > 0 &&
    plaintext.length <= MAX_BYTES, 'PLAINTEXT_BOUND');
  const pub = publicPart(recipientPublicKey); checkKey(pub);
  const key = randomBytes(32), iv = randomBytes(12);
  try {
    const envelope = {schema:SCHEMA,algorithm:ALGORITHM,recipientSHA256:recipientHash(pub),
      wrappedKey:publicEncrypt({key:pub,padding:constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash:'sha256'},key).toString('base64'),iv:iv.toString('base64')};
    const cipher = createCipheriv('aes-256-gcm',key,iv,{authTagLength:16});
    cipher.setAAD(aad(envelope));
    envelope.ciphertext = Buffer.concat([cipher.update(plaintext),cipher.final()]).toString('base64');
    envelope.tag = cipher.getAuthTag().toString('base64');
    return envelope;
  } finally { key.fill(0); }
}
export function unprotect(envelope, recipientPrivateKey) {
  requireValue(envelope && typeof envelope === 'object' && !Array.isArray(envelope) &&
    Object.keys(envelope).sort().join(',') === FIELDS.join(','), 'ENVELOPE_FIELDS');
  requireValue(envelope.schema === SCHEMA && envelope.algorithm === ALGORITHM, 'ENVELOPE_VERSION');
  requireValue(recipientPrivateKey?.type === 'private', 'PRIVATE_KEY_REQUIRED');
  checkKey(recipientPrivateKey);
  requireValue(envelope.recipientSHA256 === recipientHash(recipientPrivateKey), 'RECIPIENT_MISMATCH');
  const wrapped = decode(envelope.wrappedKey,1024);
  requireValue(wrapped.length >= 384, 'WRAPPED_KEY_BOUND');
  const iv = decode(envelope.iv,12,12), tag = decode(envelope.tag,16,16);
  const ciphertext = decode(envelope.ciphertext,MAX_BYTES);
  requireValue(ciphertext.length > 0, 'CIPHERTEXT_BOUND');
  let key; const chunks = [];
  try {
    key = privateDecrypt({key:recipientPrivateKey,padding:constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash:'sha256'},wrapped);
    requireValue(key.length === 32, 'DATA_KEY_BOUND');
    const decipher = createDecipheriv('aes-256-gcm',key,iv,{authTagLength:16});
    decipher.setAAD(aad(envelope)); decipher.setAuthTag(tag);
    chunks.push(decipher.update(ciphertext)); chunks.push(decipher.final());
    return Buffer.concat(chunks);
  } catch {
    throw new Error('ENVELOPE_AUTHENTICATION_FAILED');
  } finally { key?.fill(0); for (const chunk of chunks) chunk.fill(0); }
}
