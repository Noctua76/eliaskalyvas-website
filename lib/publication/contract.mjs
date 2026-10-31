// Phase 1 only: pure local contract validation. No network, credentials or publication authority.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { isIP } from 'node:net';
import Ajv2020 from 'ajv/dist/2020.js';

import {ContractError,canonicalize} from './canonical-json.mjs';
export {ContractError,canonicalize} from './canonical-json.mjs';
const reject = code => { throw new ContractError(code); };
const need = (condition, code) => { if (!condition) reject(code); };
const origin = 'https://eliaskalyvas.gr';
export const TIMING = Object.freeze({ start_ms: 15 * 60000, verify_ms: 30 * 60000 });

export function isUTC(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}
export function isPublicHTTPS(value) {
  if (typeof value !== 'string' || /[\s\\\u0000-\u001f]/u.test(value)) return false;
  try {
    const u = new URL(value), h = u.hostname.toLowerCase();
    return u.href === value && u.protocol === 'https:' && !u.username && !u.password && !u.port
      && !u.hash && !isIP(h) && !h.includes(':') && h.includes('.') && !h.endsWith('.')
      && !/(^|\.)(localhost|local|internal|test|invalid|example|onion)$/.test(h)
      && !h.endsWith('.home.arpa');
  } catch { return false; }
}

export const hashJSON = value => createHash('sha256').update(canonicalize(value), 'utf8').digest('hex');

// JSON.parse otherwise discards duplicate keys before schema validation can see them.
export function parseContractJSON(input) {
  need(typeof input === 'string' && Buffer.byteLength(input,'utf8') <= 4_000_000, 'INVALID_JSON_INPUT');
  let i = 0;
  const ws = () => { while (/[\x20\t\r\n]/.test(input[i] || '\0')) i++; };
  function string() {
    const start = i++;
    while (i < input.length) {
      if (input[i] === '\\') { i += 2; continue; }
      if (input[i++] === '"') { try { return JSON.parse(input.slice(start,i)); } catch { reject('INVALID_JSON'); } }
    }
    reject('INVALID_JSON');
  }
  function value(depth = 0) {
    need(depth <= 40, 'JSON_TOO_DEEP'); ws();
    if (input[i] === '"') return string();
    if (input[i] === '{') {
      i++; ws(); const result = Object.create(null), keys = new Set();
      if (input[i] === '}') { i++; return result; }
      while (i < input.length) {
        ws(); need(input[i] === '"','INVALID_JSON'); const key = string();
        need(!keys.has(key),'DUPLICATE_JSON_KEY'); keys.add(key); ws(); need(input[i++] === ':','INVALID_JSON');
        result[key] = value(depth + 1); ws(); const next = input[i++];
        if (next === '}') return result;
        need(next === ',','INVALID_JSON');
      }
    } else if (input[i] === '[') {
      i++; ws(); const result = [];
      if (input[i] === ']') { i++; return result; }
      while (i < input.length) {
        result.push(value(depth + 1)); ws(); const next = input[i++];
        if (next === ']') return result;
        need(next === ',','INVALID_JSON');
      }
    } else {
      const match = input.slice(i).match(/^(true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/);
      need(match,'INVALID_JSON'); i += match[0].length; return JSON.parse(match[0]);
    }
    reject('INVALID_JSON');
  }
  const result = value(); ws(); need(i === input.length,'INVALID_JSON'); canonicalize(result); return result;
}

const schemaRoot = new URL('../../contracts/nyra-publication/v1.1/', import.meta.url);
const ajv = new Ajv2020({ strict: true, allErrors: false, coerceTypes: false, useDefaults: false, removeAdditional: false, ownProperties: true });
ajv.addFormat('nyra-utc', isUTC);
ajv.addFormat('nyra-public-https', isPublicHTTPS);
export const schemas = Object.fromEntries(['shared','release','manifest','event','receipt','dataset'].map(name => [name, JSON.parse(readFileSync(new URL(name + '.schema.json', schemaRoot),'utf8'))]));
for (const schema of Object.values(schemas)) ajv.addSchema(schema);
const validators = Object.fromEntries(['release','manifest','event','receipt'].map(name => [name,ajv.getSchema(schemas[name].$id)]));

function structural(kind, value) {
  canonicalize(value);
  need(validators[kind](value), 'INVALID_' + kind.toUpperCase() + '_SCHEMA');
  // Defense in depth, not an arbitrary-secret/content classifier. Never echo rejected values.
  function inspect(v) {
    if (typeof v === 'string') {
      need(!/\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{12,}|\bBearer\s+[A-Za-z0-9._-]+|\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(v), 'SECRET_MATERIAL');
      need(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(v), 'CONTROL_CHARACTER');
      need(v.length === 0 || v.trim().length > 0, 'EMPTY_TEXT');
    } else if (Array.isArray(v)) v.forEach(inspect);
    else if (v && typeof v === 'object') Object.values(v).forEach(inspect);
  }
  inspect(value);
}
const nowMs = now => { need(isUTC(now),'INVALID_VALIDATION_TIME'); return Date.parse(now); };
const notFuture = (date, now) => need(Date.parse(date) <= now, 'FUTURE_TIMESTAMP');
const unique = (items, get, code) => need(new Set(items.map(get)).size === items.length, code);
const variantKey = r => r.article_id + ':' + r.locale;
export function canonicalURL(locale, slug) { return `${origin}/${locale === 'el' ? 'gr' : 'en'}/signals/${slug}/`; }

export function approvalPayload(r) {
  return Object.fromEntries(['schema_version','article_id','variant_id','locale','format','slug','canonical_url','content_revision','presentation_revision','content','presentation','identity','translation_group_id','approved_translation_relations'].map(k => [k,r[k]]));
}
export function releaseReference(r) {
  return { article_id:r.article_id, variant_id:r.variant_id, locale:r.locale, release_id:r.release.id, release_sha256:hashJSON(r), canonical_url:r.canonical_url, authorization_id:r.authorization.id };
}
export function validateRelease(r, { now } = {}) {
  structural('release',r); const clock = nowMs(now);
  need(r.canonical_url === canonicalURL(r.locale,r.slug),'CANONICAL_MISMATCH');
  need(hashJSON(r.content) === r.content_revision.sha256,'CONTENT_HASH_MISMATCH');
  need(hashJSON(r.presentation) === r.presentation_revision.sha256,'PRESENTATION_HASH_MISMATCH');
  need(hashJSON(approvalPayload(r)) === r.authorization.approved_payload_sha256,'APPROVAL_HASH_MISMATCH');
  const a = r.authorization, t = r.release;
  for (const date of [a.human_approved_at,a.publication_authorized_at,t.release_issued_at,t.first_published_at,t.modified_at]) notFuture(date,clock);
  need(a.human_approved_at <= a.publication_authorized_at && a.publication_authorized_at <= t.release_issued_at,'AUTHORIZATION_TIME_ORDER');
  need(t.first_published_at <= t.modified_at && t.modified_at === t.release_issued_at,'PUBLICATION_TIME_ORDER');
  if (a.action === 'publish') need(t.sequence === 1 && t.replaces_release_id === null && t.restores_release_id === null && t.first_published_at === t.release_issued_at,'INVALID_FIRST_RELEASE');
  else {
    need(t.sequence > 1 && t.replaces_release_id !== null && t.replaces_release_id !== t.id,'INVALID_REPLACEMENT');
    need(a.action === 'rollback' ? t.restores_release_id !== null && t.restores_release_id !== t.id : t.restores_release_id === null,'INVALID_ROLLBACK');
  }
  const sources = r.content.sources;
  unique(sources,s => s.id,'DUPLICATE_SOURCE_ID'); unique(sources,s => s.url,'DUPLICATE_SOURCE_URL');
  const ids = new Set(sources.map(s => s.id)); const used = new Set();
  for (const b of r.content.blocks) {
    const entries = b.type === 'list' ? b.items : [b];
    for (const e of entries) for (const id of e.source_ids || []) { need(ids.has(id),'UNKNOWN_SOURCE_REFERENCE'); used.add(id); }
  }
  need(used.size > 0 && sources.every(s => used.has(s.id)),'UNUSED_OR_MISSING_SOURCES');
  const c = r.presentation.cover;
  need(c.url.startsWith(origin + '/assets/signals/') && new URL(c.url).pathname.split('/').at(-1).startsWith(c.sha256 + '.'),'UNCONTROLLED_ASSET');
  const ext = { 'image/jpeg':'jpg','image/png':'png','image/webp':'webp' }[c.mime_type];
  need(c.url === `${origin}/assets/signals/${c.sha256}.${ext}`,'ASSET_IDENTITY_MISMATCH');
  need(c.kind === 'editorial_template' ? c.template_id !== null && c.attribution.rights_basis === 'owned' : c.template_id === null,'INVALID_TEMPLATE');
  need(!r.presentation.related_article_ids.includes(r.article_id),'SELF_RELATED_ARTICLE');
  const relations = r.approved_translation_relations;
  need(r.translation_group_id !== null || relations.length === 0,'MISSING_TRANSLATION_GROUP');
  for (const x of relations) need(x.locale !== r.locale && x.article_id !== r.article_id && x.variant_id !== r.variant_id,'INVALID_TRANSLATION_RELATION');
  return r;
}

export function validateManifest(m, { now } = {}) {
  structural('manifest',m); const clock = nowMs(now); notFuture(m.issued_at,clock);
  need(m.generation === 1 ? m.previous_manifest_sha256 === null : m.previous_manifest_sha256 !== null,'INVALID_MANIFEST_CHAIN');
  unique(m.active_releases,variantKey,'DUPLICATE_ACTIVE_VARIANT');
  for (const key of ['article_id','variant_id','release_id','canonical_url','authorization_id']) unique(m.active_releases,r => r[key],'DUPLICATE_ACTIVE_IDENTITY');
  for (const r of m.active_releases) need(r.canonical_url.startsWith(`${origin}/${r.locale === 'el' ? 'gr' : 'en'}/signals/`),'MANIFEST_CANONICAL_MISMATCH');
  unique(m.withdrawn_variants,r => r.variant_id,'DUPLICATE_WITHDRAWAL');
  for (const w of m.withdrawn_variants) {
    notFuture(w.withdrawn_at,clock); need(w.withdrawn_at <= m.issued_at,'WITHDRAWAL_TIME_ORDER');
    need(!m.active_releases.some(r => r.variant_id === w.variant_id || r.article_id === w.article_id),'ACTIVE_WITHDRAWN_CONFLICT');
  }
  return m;
}

// Complete dataset gate. A standalone valid release never establishes authority or active status.
export function validatePublicationSet(value, { now, events = [], previous = null, history = [] } = {}) {
  canonicalize(value);
  need(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 2 && Object.hasOwn(value,'manifest') && Object.hasOwn(value,'releases'),'INVALID_PUBLICATION_SET');
  const { manifest, releases } = value;
  validateManifest(manifest,{now});
  need(Array.isArray(releases) && releases.length === manifest.active_releases.length,'RELEASE_SET_MISMATCH');
  const byId = new Map();
  for (const r of releases) { validateRelease(r,{now}); need(!byId.has(r.release.id),'DUPLICATE_RELEASE'); byId.set(r.release.id,r); }
  for (const ref of manifest.active_releases) {
    const r = byId.get(ref.release_id); need(r && canonicalize(ref) === canonicalize(releaseReference(r)),'RELEASE_REFERENCE_MISMATCH');
    need(r.release.release_issued_at <= manifest.issued_at,'MANIFEST_TIME_ORDER');
  }
  for (const r of releases) {
    for (const relation of r.approved_translation_relations) {
      const target = releases.find(t => t.variant_id === relation.variant_id);
      need(!releases.some(t => t.article_id === relation.article_id && t.variant_id !== relation.variant_id),'TRANSLATION_VARIANT_MISMATCH');
      // Dormant approved relationships are not navigation or authorization to export a counterpart.
      if (!target) continue;
      need(target.article_id === relation.article_id && target.locale === relation.locale && target.translation_group_id === r.translation_group_id,'TRANSLATION_TARGET_MISMATCH');
      need(target.approved_translation_relations.some(x => x.variant_id === r.variant_id && x.article_id === r.article_id && x.locale === r.locale),'NONRECIPROCAL_TRANSLATION');
    }
    for (const id of r.presentation.related_article_ids) need(releases.some(t => t.article_id === id && t.locale === r.locale),'UNRELEASED_RELATED_ARTICLE');
  }
  if (previous) validateTransition(previous,{manifest,releases},events,{now,history});
  return {manifest,releases};
}
export function activeTranslationRelations(release, releases) {
  return release.approved_translation_relations.filter(x => releases.some(r => r.variant_id === x.variant_id && r.article_id === x.article_id && r.locale === x.locale && r.translation_group_id === release.translation_group_id && r.approved_translation_relations.some(y => y.variant_id === release.variant_id)));
}

export function validateEvent(e, { now } = {}) {
  structural('event',e); notFuture(e.authorized_at,nowMs(now));
  if (e.action !== 'withdraw') {
    const r = e.new_release;
    need(r.article_id === e.article_id && r.variant_id === e.variant_id && r.locale === e.locale && r.authorization_id === e.authorization_id,'EVENT_IDENTITY_MISMATCH');
    need(r.release_id !== e.target_release_id,'EVENT_RELEASE_REUSE');
    if(e.action === 'rollback') need(r.release_id !== e.restores_release_id,'ROLLBACK_RELEASE_REUSE');
  }
  return e;
}

export function validateTransition(previous,next,events,{now,history=[]} = {}) {
  validatePublicationSet(previous,{now}); validatePublicationSet(next,{now});
  need(next.manifest.generation === previous.manifest.generation + 1 && next.manifest.previous_manifest_sha256 === hashJSON(previous.manifest),'STALE_MANIFEST_GENERATION');
  need(next.manifest.issued_at >= previous.manifest.issued_at,'MANIFEST_TIME_ORDER');
  need(Array.isArray(events),'MISSING_EVENTS'); unique(events,e => e.id,'DUPLICATE_EVENT'); unique(events,e => e.variant_id,'DUPLICATE_VARIANT_EVENT'); unique(events,e => e.authorization_id,'DUPLICATE_AUTHORIZATION');
  const historical = [...previous.releases,...history];
  for (const r of history) validateRelease(r,{now});
  // An immutable ID may never describe different bytes, even outside the active set.
  const knownIds = new Map();
  for (const r of historical) {
    const known = knownIds.get(r.release.id);
    need(!known || hashJSON(known) === hashJSON(r),'CONFLICTING_HISTORY');
    knownIds.set(r.release.id,r);
  }
  for (const r of next.releases) {
    const known = historical.find(p => p.release.id === r.release.id);
    if (known) need(hashJSON(known) === hashJSON(r),'IMMUTABLE_RELEASE_CHANGED');
    for (const old of historical) {
      if (r.article_id === old.article_id || r.variant_id === old.variant_id) need(r.article_id === old.article_id && r.variant_id === old.variant_id && r.locale === old.locale && r.canonical_url === old.canonical_url,'STABLE_IDENTITY_CHANGED');
      if (r.content_revision.id === old.content_revision.id) need(r.variant_id === old.variant_id && r.content_revision.sha256 === old.content_revision.sha256,'CONTENT_REVISION_REUSED');
      if (r.presentation_revision.id === old.presentation_revision.id) need(r.variant_id === old.variant_id && canonicalize(r.presentation_revision) === canonicalize(old.presentation_revision),'PRESENTATION_REVISION_REUSED');
    }
  }
  const changed = new Set();
  for (const e of events) {
    validateEvent(e,{now});
    need(e.expected_generation === previous.manifest.generation && e.expected_manifest_sha256 === hashJSON(previous.manifest),'STALE_EVENT');
    need(e.authorized_at <= next.manifest.issued_at,'EVENT_TIME_ORDER');
    const old = previous.releases.find(r => r.variant_id === e.variant_id), fresh = next.releases.find(r => r.variant_id === e.variant_id);
    if (e.action === 'withdraw') {
      need(old && old.article_id === e.article_id && old.locale === e.locale && old.release.id === e.target_release_id && !fresh,'INVALID_WITHDRAWAL');
      need(next.manifest.withdrawn_variants.some(w => w.variant_id === e.variant_id && w.article_id === e.article_id && w.locale === e.locale && w.event_id === e.id && w.target_release_id === e.target_release_id && w.withdrawn_at === e.authorized_at),'MISSING_WITHDRAWAL_RECORD');
    } else {
      need(fresh && canonicalize(releaseReference(fresh)) === canonicalize(e.new_release),'EVENT_RELEASE_MISMATCH');
      need(fresh.authorization.action === e.action && fresh.authorization.publication_authorized_at === e.authorized_at && fresh.authorization.approved_payload_sha256 === e.approved_payload_sha256,'EVENT_APPROVAL_MISMATCH');
      need(!historical.some(r => r.release.id === fresh.release.id),'REUSED_RELEASE_ID');
      need(!historical.some(r => r.authorization.id === fresh.authorization.id),'REUSED_AUTHORIZATION_ID');
      if (e.action === 'publish') {
        need(!old && !historical.some(r => r.article_id === e.article_id || r.variant_id === e.variant_id) && !previous.manifest.withdrawn_variants.some(w => w.article_id === e.article_id || w.variant_id === e.variant_id),'ARTICLE_ALREADY_PUBLISHED');
      } else {
        const prior = old || historical.filter(r => r.variant_id === e.variant_id).sort((a,b) => b.release.sequence-a.release.sequence)[0];
        need(prior && prior.release.id === e.target_release_id && prior.article_id === fresh.article_id && prior.locale === fresh.locale && prior.canonical_url === fresh.canonical_url,'REPLACEMENT_IDENTITY_MISMATCH');
        need(fresh.release.sequence === prior.release.sequence + 1 && fresh.release.replaces_release_id === prior.release.id && fresh.release.first_published_at === prior.release.first_published_at && fresh.release.modified_at > prior.release.modified_at,'REPLACEMENT_LINEAGE_MISMATCH');
        need(fresh.content_revision.id !== prior.content_revision.id || fresh.content_revision.sha256 === prior.content_revision.sha256,'CONTENT_REVISION_REUSED');
        need(fresh.presentation_revision.id !== prior.presentation_revision.id || canonicalize(fresh.presentation_revision) === canonicalize(prior.presentation_revision),'PRESENTATION_REVISION_REUSED');
        if (e.action === 'replace') need(old,'REPLACE_WITHDRAWN_ARTICLE');
        else {
          const restore = historical.find(r => r.release.id === e.restores_release_id);
          need(restore && restore.variant_id === fresh.variant_id && restore.article_id === fresh.article_id && restore.locale === fresh.locale && fresh.release.restores_release_id === restore.release.id,'UNKNOWN_ROLLBACK_TARGET');
          need(fresh.content_revision.sha256 === restore.content_revision.sha256 && fresh.presentation_revision.sha256 === restore.presentation_revision.sha256,'ROLLBACK_PAYLOAD_MISMATCH');
        }
      }
    }
    changed.add(e.variant_id);
  }
  for (const r of [...previous.releases,...next.releases]) {
    const old = previous.releases.find(x => x.variant_id === r.variant_id), fresh = next.releases.find(x => x.variant_id === r.variant_id);
    if (!old || !fresh || hashJSON(old) !== hashJSON(fresh)) need(changed.has(r.variant_id),'UNAUTHORIZED_MANIFEST_CHANGE');
  }
  for (const w of next.manifest.withdrawn_variants) need(previous.manifest.withdrawn_variants.some(p => canonicalize(p) === canonicalize(w)) || events.some(e => e.action === 'withdraw' && e.id === w.event_id && e.article_id === w.article_id && e.variant_id === w.variant_id && e.locale === w.locale && e.target_release_id === w.target_release_id && e.authorized_at === w.withdrawn_at),'UNAUTHORIZED_WITHDRAWAL_RECORD');
  for (const w of previous.manifest.withdrawn_variants) need(next.manifest.withdrawn_variants.some(n => canonicalize(n) === canonicalize(w)) || events.some(e => e.action === 'rollback' && e.variant_id === w.variant_id),'WITHDRAWAL_RECORD_REMOVED');
  return next;
}

export function validateDeploymentTiming(releases,{now,phase} = {}) {
  const clock = nowMs(now); need(phase === 'start' || phase === 'verify','INVALID_TIMING_PHASE');
  for (const r of releases) {
    validateRelease(r,{now});
    need(clock-Date.parse(r.release.release_issued_at) <= (phase === 'start' ? TIMING.start_ms : TIMING.verify_ms),'DEPLOYMENT_WINDOW_EXPIRED');
  }
  return true;
}

// Derive pending releases from the last verified-live dataset and every authorized
// intervening transition. Never let a caller choose which releases receive timing checks.
function receiptReleases(transition,manifest,now) {
  need(transition && typeof transition === 'object' && !Array.isArray(transition),'MISSING_RECEIPT_TRANSITION');
  canonicalize(transition);
  need(Object.keys(transition).length === 2 && Object.hasOwn(transition,'previous') && Object.hasOwn(transition,'steps'),'INVALID_RECEIPT_TRANSITION');
  need(Array.isArray(transition.steps) && transition.steps.length <= 1000,'INVALID_RECEIPT_TRANSITION');
  validatePublicationSet(transition.previous,{now});
  let current = transition.previous;
  for (const step of transition.steps) {
    need(step && typeof step === 'object' && !Array.isArray(step) && Object.keys(step).length === 3 && ['next','events','history'].every(k => Object.hasOwn(step,k)),'INVALID_RECEIPT_TRANSITION');
    need(Array.isArray(step.events) && Array.isArray(step.history),'INVALID_RECEIPT_TRANSITION');
    validateTransition(current,step.next,step.events,{now,history:step.history});
    current = step.next;
  }
  need(canonicalize(current.manifest) === canonicalize(manifest),'RECEIPT_TRANSITION_MISMATCH');
  const retained = new Set(transition.previous.releases.map(r => r.release.id));
  return current.releases.filter(r => !retained.has(r.release.id));
}

// Operational record contract only. Trusted storage must supply transition evidence;
// this module cannot authenticate a caller's claimed baseline or delivery observations.
export function validateReceipt(receipt,options = {}) {
  need(!Object.hasOwn(options,'newReleases'),'CALLER_SUPPLIED_RELEASE_SET');
  const {manifest,now,transition} = options;
  structural('receipt',receipt); const clock = nowMs(now); validateManifest(manifest,{now});
  need(receipt.manifest_id === manifest.manifest_id && receipt.generation === manifest.generation && receipt.manifest_sha256 === hashJSON(manifest),'RECEIPT_MANIFEST_MISMATCH');
  for (const key of ['deployment_requested_at','deployment_completed_at','verified_live_at']) if(receipt[key] !== null) notFuture(receipt[key],clock);
  need(receipt.deployment_requested_at >= manifest.issued_at,'RECEIPT_TIME_ORDER');
  if(receipt.deployment_completed_at !== null) need(receipt.deployment_completed_at >= receipt.deployment_requested_at && receipt.github_deployment_id !== null,'RECEIPT_TIME_ORDER');
  if(receipt.verified_live_at !== null) need(receipt.deployment_completed_at !== null && receipt.verified_live_at >= receipt.deployment_completed_at,'RECEIPT_TIME_ORDER');
  if(receipt.status === 'released_verified') {
    need(receipt.github_deployment_id !== null && receipt.deployment_completed_at !== null && receipt.verified_live_at !== null && receipt.observed_manifest_sha256 === receipt.manifest_sha256,'UNVERIFIED_RECEIPT');
    const newReleases = receiptReleases(transition,manifest,receipt.deployment_requested_at);
    validateDeploymentTiming(newReleases,{now:receipt.deployment_requested_at,phase:'start'});
    validateDeploymentTiming(newReleases,{now:receipt.verified_live_at,phase:'verify'});
  }
  if(receipt.status === 'release_failed' || receipt.status === 'delivery_unknown') need(receipt.verified_live_at === null && receipt.observed_manifest_sha256 === null,'CONFLICTING_RECEIPT_STATUS');
  if(receipt.status === 'timing_exception') need(receipt.deployment_completed_at !== null,'MISSING_DEPLOYMENT_RESULT');
  return receipt;
}

function mapBlocks(blocks,sources,records) {
  need(Array.isArray(sources) && sources.length > 0 && sources.length <= 60,'INVALID_SOURCE_INPUT');
  const byURL = new Map();
  const publicSources = sources.map((s,i) => {
    need(s && isPublicHTTPS(s.url) && typeof s.title === 'string' && s.title.trim(),'INVALID_SOURCE_INPUT');
    need(!byURL.has(s.url),'DUPLICATE_SOURCE_URL'); const id = 's'+(i+1); byURL.set(s.url,id); return {id,title:s.title,url:s.url};
  });
  const receipts = new Map();
  for (const r of records || []) if (r.status === 'captured') for (const e of r.excerpts || []) { need(!receipts.has(e.id),'DUPLICATE_EVIDENCE_ID'); receipts.set(e.id,r.source_url); }
  function text(b) {
    need(b && typeof b.text === 'string' && Array.isArray(b.source_urls) && Array.isArray(b.evidence_ids),'INVALID_BLOCK_INPUT');
    unique(b.source_urls,u => u,'DUPLICATE_BLOCK_SOURCE'); unique(b.evidence_ids,id => id,'DUPLICATE_BLOCK_EVIDENCE');
    for (const id of b.evidence_ids) need(receipts.has(id) && b.source_urls.includes(receipts.get(id)),'INVALID_EVIDENCE_REFERENCE');
    return {text:b.text,source_ids:b.source_urls.map(url => { need(byURL.has(url),'UNKNOWN_SOURCE_URL'); return byURL.get(url); })};
  }
  const mapped = blocks.map(b => {
    const keys = {paragraph:['type','text','source_urls','evidence_ids'],quote:['type','text','source_urls','evidence_ids','attribution'],heading:['type','level','text'],list:['type','ordered','items']}[b?.type];
    need(keys,'UNSUPPORTED_CONTENT_BLOCK');
    need(Object.keys(b).every(k => keys.includes(k)),'UNSUPPORTED_BLOCK_FIELD');
    if (b.type === 'paragraph') return {type:'paragraph',...text(b)};
    if (b.type === 'quote') return {type:'quote',...text(b),attribution:b.attribution};
    if (b.type === 'heading') { need(b.level === 2 && typeof b.text === 'string','INVALID_HEADING'); return {type:'heading',level:2,text:b.text}; }
    if (b.type === 'list') { need(b.ordered === false && Array.isArray(b.items),'INVALID_LIST'); return {type:'list',ordered:false,items:b.items.map(text)}; }
    reject('UNSUPPORTED_CONTENT_BLOCK');
  });
  const used = new Set(mapped.flatMap(b => b.type === 'list' ? b.items.flatMap(i => i.source_ids) : b.source_ids || []));
  return {blocks:mapped,sources:publicSources.filter(s => used.has(s.id))};
}
export function mapNyraContent(draft) {
  const a = draft?.article;
  need(a && Array.isArray(a.paragraphs) && a.paragraphs.length > 0 && a.paragraphs.length <= 60 && !('blocks' in a) && !('body' in a),'UNSUPPORTED_ARTICLE_INPUT');
  const mapped = mapBlocks(a.paragraphs.map(p => { need(Object.keys(p).every(k => ['text','source_urls','evidence_ids'].includes(k)),'UNSUPPORTED_PARAGRAPH_FIELD'); return {type:'paragraph',...p}; }),draft.sources,draft.research?.source_records);
  const content = {title:a.title,summary:a.summary,...mapped};
  need(ajv.getSchema(schemas.shared.$id+'#/$defs/content')(content),'INVALID_CONTENT_SCHEMA');
  return content;
}
// Explicit structured input only; caller must approve/hash this exact projection in Phase 2.
export function mapStructuredContent({title,summary,blocks,sources,source_records=[]}) {
  const content = {title,summary,...mapBlocks(blocks,sources,source_records)};
  need(ajv.getSchema(schemas.shared.$id+'#/$defs/content')(content),'INVALID_CONTENT_SCHEMA'); return content;
}
