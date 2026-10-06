import test from 'node:test';
import assert from 'node:assert/strict';
import { CONSENT_KEY, CONSENT_VERSION, makeConsent, parseConsent, readConsent, saveConsent, categoryAllowed, legalPath, isPlainClick } from '../src/legal/consent.js';
import { legalStaticMarkup } from '../src/legal/static-markup.js';
import { legalDocuments } from '../src/legal/legal-content.js';
const now = new Date('2026-10-06T19:00:00.000Z');
const memory = () => { const entries = new Map(); return { getItem:k => entries.get(k) ?? null, setItem:(k,v) => entries.set(k,v) }; };

test('first visit, invalid or outdated consent keeps optional processing denied', () => {
  assert.equal(readConsent(memory()), null);
  for (const raw of ['{', 'null', '{}', JSON.stringify({ ...makeConsent({}, now), version: CONSENT_VERSION - 1 }), JSON.stringify({ ...makeConsent({}, now), timestamp: 'bad' }), JSON.stringify({ ...makeConsent({}, now), necessary: false })]) assert.equal(parseConsent(raw), null);
  for (const c of [null, { version: CONSENT_VERSION - 1, analytics: true, marketing: true }]) {
    assert.equal(categoryAllowed(c, 'analytics'), false); assert.equal(categoryAllowed(c, 'marketing'), false);
  }
});
test('accept all does not authorise absent or unknown future trackers', () => {
  const c = makeConsent({ analytics: true, marketing: true }, now);
  assert.deepEqual(c, { version: CONSENT_VERSION, necessary: true, analytics: false, marketing: false, timestamp: now.toISOString() });
  assert.equal(categoryAllowed({ ...c, analytics: true }, 'analytics'), false);
  assert.equal(categoryAllowed(c, 'unknown'), false);
});
test('reject and changed preferences persist locally with version and timestamp', () => {
  const store = memory();
  const accepted = saveConsent(store, { analytics: true, marketing: true }, now);
  assert.equal(accepted.persisted, true); assert.deepEqual(readConsent(store), accepted.consent);
  const later = new Date(now.getTime() + 1000);
  const rejected = saveConsent(store, { analytics: false, marketing: false }, later);
  assert.equal(readConsent(store).timestamp, later.toISOString());
  assert.equal(JSON.parse(store.getItem(CONSENT_KEY)).necessary, true);
  assert.equal(rejected.consent.marketing, false);
});
test('blocked storage never crashes public forms or permits optional processing', () => {
  const blocked = { getItem(){throw Error('blocked');}, setItem(){throw Error('blocked');} };
  assert.equal(readConsent(blocked), null);
  const result = saveConsent(blocked, {}, now);
  assert.equal(result.persisted, false); assert.equal(result.consent.necessary, true);
  assert.equal(categoryAllowed(result.consent, 'analytics'), false);
  assert.equal(saveConsent(null, {}, now).persisted, false);
});
test('real legal URLs support Pages base and future root domain', () => {
  assert.equal(legalPath('/eliaskalyvas-website/', 'el', 'privacy'), '/eliaskalyvas-website/gr/privacy/');
  assert.equal(legalPath('/', 'en', 'terms'), '/en/terms/');
  for (const extra of [{ctrlKey:true}, {metaKey:true}, {shiftKey:true}, {altKey:true}, {button:1}, {defaultPrevented:true}]) assert.equal(isPlainClick({button:0,...extra}), false);
  assert.equal(isPlainClick({button:0}), true);
});
test('all four public documents expose complete shared legal text without JavaScript', () => {
  for (const lang of ['el','en']) for (const kind of ['privacy','terms']) {
    const doc = legalDocuments[lang][kind]; const html = legalStaticMarkup(lang,kind,'/eliaskalyvas-website/');
    assert.ok(doc.sections.length >= 12); assert.match(html, /info@eliaskalyvas.gr/);
    assert.match(html, /Signals/); assert.ok(html.includes(doc.title));
    assert.ok(html.includes(doc.sections.at(-1).heading));
    assert.ok(html.includes(`/eliaskalyvas-website/${lang === 'el' ? 'gr' : 'en'}/`));
    assert.ok(!html.includes('<script')); assert.ok(!html.includes('placeholder'));
  }
  assert.equal(legalDocuments.el.privacy.sections.length, legalDocuments.en.privacy.sections.length);
  assert.equal(legalDocuments.el.terms.sections.length, legalDocuments.en.terms.sections.length);
});
