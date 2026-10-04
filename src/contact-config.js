import { operationsConfig, request } from './operations/config.js';
// Only configure approved public URLs. Never put provider secrets in VITE_* values.
const httpsUrl = value => {
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : ''; }
  catch { return ''; }
};

export const contactConfig = {
  endpoint: operationsConfig.apiUrl,
  linkedInUrl: 'https://www.linkedin.com/in/eliaskalyvas/',
  youtubeUrl: httpsUrl(import.meta.env.VITE_YOUTUBE_URL),
  instagramUrl: httpsUrl(import.meta.env.VITE_INSTAGRAM_URL),
  privacyUrl: httpsUrl(import.meta.env.VITE_PRIVACY_URL),
  termsUrl: httpsUrl(import.meta.env.VITE_TERMS_URL),
};

export function contactEmailHref({ name = '', email = '', message = '', interest = '' } = {}) {
  const subject = interest ? `Let’s build — ${interest}` : 'Let’s build';
  const body = [name && `Name: ${name}`, email && `Email: ${email}`, interest && `Interest: ${interest}`, '', message].filter(line => line !== false).join('\n');
  return `mailto:info@eliaskalyvas.gr?cc=iliaskalivas%40hotmail.com&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// Success means durable acceptance in Supabase; notification delivery is tracked separately.
export async function sendContactMessage(payload) {
  if (!contactConfig.endpoint) return { status: 'email' };
  const result = await request('/messages', payload);
  if (!result.accepted || !result.id) throw new Error('Message was not accepted');
  return { status: 'success', id: result.id };
}
