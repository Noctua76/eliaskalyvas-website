export const CONSENT_VERSION = 1;
export const CONSENT_KEY = 'eliaskalyvas.cookie-preferences';
// No optional providers are configured. Enabling one requires a new informed consent version.
export const optionalCategories = Object.freeze({ analytics: false, marketing: false });
export function makeConsent(choices = {}, now = new Date()) {
  return { version: CONSENT_VERSION, necessary: true,
    analytics: optionalCategories.analytics && choices.analytics === true,
    marketing: optionalCategories.marketing && choices.marketing === true,
    timestamp: now.toISOString() };
}
export function parseConsent(raw) {
  try {
    const c = JSON.parse(raw);
    if (!c || c.version !== CONSENT_VERSION || c.necessary !== true ||
      typeof c.analytics !== 'boolean' || typeof c.marketing !== 'boolean' ||
      typeof c.timestamp !== 'string' || !Number.isFinite(Date.parse(c.timestamp))) return null;
    return { ...c, analytics: c.analytics && optionalCategories.analytics,
      marketing: c.marketing && optionalCategories.marketing };
  } catch { return null; }
}
export function readConsent(storage) {
  try { return parseConsent(storage.getItem(CONSENT_KEY)); } catch { return null; }
}
export function saveConsent(storage, choices, now) {
  const consent = makeConsent(choices, now);
  try { storage.setItem(CONSENT_KEY, JSON.stringify(consent)); return { consent, persisted: true }; }
  catch { return { consent, persisted: false }; }
}
export function categoryAllowed(consent, category) {
  return !!(optionalCategories[category] && consent?.version === CONSENT_VERSION && consent[category] === true);
}
export const legalPath = (base, lang, kind) => `${base}${lang === 'el' ? 'gr' : 'en'}/${kind}/`;
export const isPlainClick = event => event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && !event.defaultPrevented;
