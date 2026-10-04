// Only configure approved public URLs. Never put provider secrets in VITE_* values.
const httpsUrl = value => {
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : ''; }
  catch { return ''; }
};

export const contactConfig = {
  endpoint: httpsUrl(import.meta.env.VITE_CONTACT_ENDPOINT),
  meetingUrl: httpsUrl(import.meta.env.VITE_MEETING_URL) || 'https://calendly.com/eliaskalyvas',
  linkedInUrl: 'https://www.linkedin.com/in/eliaskalyvas/',
  youtubeUrl: httpsUrl(import.meta.env.VITE_YOUTUBE_URL),
  instagramUrl: httpsUrl(import.meta.env.VITE_INSTAGRAM_URL),
  privacyUrl: httpsUrl(import.meta.env.VITE_PRIVACY_URL),
  termsUrl: httpsUrl(import.meta.env.VITE_TERMS_URL),
};

export function contactEmailHref({ name = '', email = '', message = '', interest = '' } = {}) {
  const subject = interest ? `Let’s build — ${interest}` : 'Let’s build';
  const body = [name && `Name: ${name}`, email && `Email: ${email}`, interest && `Interest: ${interest}`, '', message].filter(line => line !== false).join('\n');
  return `mailto:info@eliaskalyvas.gr?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// JSON POST contract: { name, email, message, interest, language }.
// A configured provider must support CORS and return 2xx only after accepting delivery.
export async function sendContactMessage(payload, endpoint = contactConfig.endpoint) {
  if (!endpoint) return { status: 'email' };
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload), signal: controller.signal, credentials: 'omit',
    });
    if (!response.ok) throw new Error('Message was not accepted');
    // Providers may additionally signal a delivery error in their JSON response.
    if (response.headers.get('content-type')?.includes('application/json')) {
      const result = await response.json();
      if (result.success === false || result.error) throw new Error('Message was not accepted');
    }
    return { status: 'success' };
  } finally { window.clearTimeout(timeout); }
}
