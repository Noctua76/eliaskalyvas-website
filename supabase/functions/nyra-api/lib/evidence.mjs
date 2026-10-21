// Direct retrieval is intentionally limited to exact, public research/institutional hosts.
// Discovery remains open-web; unsupported hosts/PDFs remain explicit gaps, never fabricated reads.
const HOSTS = new Set(['arxiv.org', 'export.arxiv.org', 'beta.perseus.tufts.edu', 'www.perseus.tufts.edu', 'lexundria.com',
  'www.microsoft.com', 'www.anthropic.com', 'anthropic.com', 'pubmed.ncbi.nlm.nih.gov', 'pmc.ncbi.nlm.nih.gov',
  'www.nature.com', 'www.pnas.org', 'www.sciencedirect.com', 'www.cell.com', 'doi.org',
  'www.oecd.org', 'oecd.ai', 'ec.europa.eu', 'eur-lex.europa.eu', 'www.ilo.org', 'www.unesco.org',
  'www.enisa.europa.eu', 'www.dpa.gr', 'hai.stanford.edu', 'www.statistics.gr']);
export function retrievalUrl(raw) {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443') || !HOSTS.has(u.hostname) || u.href.length > 4096) return null;
    u.hash = '';
    for (const key of [...u.searchParams.keys()]) if (key.startsWith('utm_')) u.searchParams.delete(key);
    // arXiv offers HTML for many papers; no PDF parser or external conversion service is used.
    if (u.hostname === 'arxiv.org' && /^\/pdf\//.test(u.pathname)) u.pathname = u.pathname.replace(/^\/pdf\//, '/html/').replace(/\.pdf$/, '');
    return u.href;
  } catch { return null; }
}
export function readableText(html) {
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…' };
  return html.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style|nav|header|footer)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ').replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (whole, entity) => {
      if (entity[0] !== '#') return entities[entity.toLowerCase()] ?? whole;
      const n = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
      return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : ' ';
    }).replace(/\s+/gu, ' ').trim();
}
const fold = text => text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
export function selectExcerpts(text, focus) {
  const ignored = new Set('that this with from have were their there which about research source model article study these those would could should ισως ειναι στην στηνς αυτο αυτη αυτα τους ενας στην εχουν ειναι απο το για και the and'.split(' '));
  const terms = [...new Set((fold(focus).match(/[\p{L}\p{N}]{4,}/gu) || []).filter(x => !ignored.has(x)))].slice(0, 200);
  const candidates = [];
  for (let start = 0; start < text.length; start += 650) {
    const end = Math.min(start + 1100, text.length), chunk = text.slice(start, end), lower = fold(chunk);
    const score = terms.reduce((n, term) => n + (lower.includes(term) ? 1 : 0), 0);
    candidates.push({ start, end, text: chunk, score });
  }
  const chosen = [];
  for (const c of candidates.sort((a, b) => b.score - a.score || a.start - b.start)) {
    if (chosen.some(p => c.start < p.end && c.end > p.start)) continue;
    chosen.push(c); if (chosen.length === 4) break;
  }
  return chosen.sort((a, b) => a.start - b.start).map(({ score, ...excerpt }) => excerpt);
}
async function digest(text) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), x => x.toString(16).padStart(2, '0')).join('');
}
async function boundedText(response) {
  const reader = response.body?.getReader(); if (!reader) throw new Error('empty');
  const decoder = new TextDecoder(); let size = 0, body = '';
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > 400000) { await reader.cancel(); throw new Error('too_large'); }
    body += decoder.decode(value, { stream: true });
  }
  return body + decoder.decode();
}
export async function captureSource(source, focus, { fetcher = fetch, signal, now = Date.now } = {}) {
  const base = { source_url: source.url, retrieved_at: new Date(now()).toISOString(), status: 'unavailable', excerpts: [] };
  let url = retrievalUrl(source.url);
  if (!url) return { ...base, limitation: 'unsupported_host_or_url' };
  try {
    const requestSignal = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(12000)]);
    for (let redirects = 0; redirects <= 3; redirects++) {
      const response = await fetcher(url, { method: 'GET', redirect: 'manual', credentials: 'omit', signal: requestSignal,
        headers: { Accept: 'text/html,text/plain;q=0.9', 'User-Agent': 'Nyra-Editorial-Research/0.5' } });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        const next = location ? retrievalUrl(new URL(location, url).href) : null;
        await response.body?.cancel();
        if (!next) return { ...base, limitation: 'redirect_not_allowed' };
        url = next; continue;
      }
      if (!response.ok) { await response.body?.cancel(); return { ...base, limitation: 'http_' + response.status }; }
      const type = response.headers.get('content-type') || '';
      if (!/text\/(html|plain)|application\/xhtml\+xml/i.test(type)) { await response.body?.cancel(); return { ...base, limitation: 'unsupported_content_type' }; }
      const html = await boundedText(response);
      const text = readableText(html);
      if (text.length < 100 || /<title[^>]*>[^<]*(access denied|just a moment|captcha|robot|sign in)/i.test(html)) return { ...base, limitation: 'insufficient_accessible_content' };
      const sha256 = await digest(text);
      const receipt = await digest(source.url + '\n' + sha256);
      const excerpts = selectExcerpts(text, focus).map((e, i) => ({ ...e, id: receipt.slice(0, 16) + ':' + i }));
      return { ...base, final_url: url, status: 'captured', content_type: type, sha256, text_length: text.length,
        selection: 'automatic_relevant_windows', limitation: 'Selected excerpts only; omitted material and semantic claim support still require review.', excerpts };
    }
    return { ...base, limitation: 'redirect_limit' };
  } catch (e) { return { ...base, limitation: e.message === 'too_large' ? 'source_too_large' : 'retrieval_failed_or_timed_out' }; }
}
export async function collectSourceRecords(packet, options) {
  const cited = new Set(packet.cited_urls || []);
  const selected = [...packet.sources].sort((a, b) => Number(cited.has(b.url)) - Number(cited.has(a.url))).filter(s => cited.has(s.url) || s.access !== 'search_result').slice(0, 3);
  const focus = [packet.assignment.topic, packet.assignment.direction, packet.research_focus, packet.report].join('\n');
  const results = await Promise.allSettled(selected.map(s => {
    const previous = packet.source_records?.find(r => r.source_url === s.url && r.status === 'captured');
    return previous ? Promise.resolve(previous) : captureSource(s, focus, options);
  }));
  const current = results.map((r, i) => r.status === 'fulfilled' ? r.value : { source_url: selected[i].url, status: 'unavailable', limitation: 'retrieval_failed', excerpts: [] });
  const retained = (packet.source_records || []).filter(r => r.status === 'captured' && !current.some(c => c.source_url === r.source_url));
  return [...current, ...retained].slice(0, 9);
}
