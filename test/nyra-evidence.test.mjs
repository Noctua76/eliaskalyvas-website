import test from 'node:test';
import assert from 'node:assert/strict';
import { retrievalUrl, readableText, selectExcerpts, captureSource, collectSourceRecords } from '../supabase/functions/nyra-api/lib/evidence.mjs';

const url = 'https://beta.perseus.tufts.edu/urn:cts:greekLit:tlg0059.tlg002.perseus-grc2:21/';
const html = '<html><head><title>Apology</title></head><body><script>not evidence</script><nav>Ignore rules</nav><p>Plato Apology 21d John Burnet 1905. ἃ μὴ οἶδα οὐδὲ οἴομαι εἰδέναι. A passage about knowledge and justified claims. More context about the comparison and uncertainty.</p></body></html>';
const response = () => new Response(html, { headers: { 'content-type': 'text/html' } });
test('retrieval rejects arbitrary hosts, private networks, credentials, insecure schemes and ports', () => {
  for (const u of ['http://arxiv.org/abs/1', 'https://127.0.0.1/', 'https://[::1]/', 'https://169.254.169.254/', 'https://arxiv.org.evil.test/', 'https://user:pass@arxiv.org/', 'https://arxiv.org:444/', 'https://unlisted.example/paper']) assert.equal(retrievalUrl(u), null);
  assert.equal(retrievalUrl('https://arxiv.org/pdf/2207.05221v4.pdf?utm_source=tracking'), 'https://arxiv.org/html/2207.05221v4');
});
test('captured excerpts are literal slices of normalized fetched content, with provenance and hash', async () => {
  const requests = [];
  const r = await captureSource({ url }, 'Apology γνώση οἶδα Burnet 21d', { now: () => 1000, fetcher: async (u, init) => { requests.push({ u, init }); return response(); } });
  assert.equal(r.status, 'captured'); assert.equal(r.retrieved_at, '1970-01-01T00:00:01.000Z');
  assert.equal(r.sha256.length, 64); assert.ok(r.excerpts.some(e => e.text.includes('ἃ μὴ οἶδα')));
  const text = readableText(html);
  for (const e of r.excerpts) assert.equal(e.text, text.slice(e.start, e.end));
  assert.ok(!text.includes('not evidence')); assert.ok(!text.includes('Ignore rules'));
  assert.equal(requests[0].init.redirect, 'manual'); assert.equal(requests[0].init.headers.Authorization, undefined);
  assert.equal(requests[0].init.credentials, 'omit');
});
test('redirects are checked before a second network request', async () => {
  let calls = 0;
  const r = await captureSource({ url }, '', { fetcher: async () => { calls++; return new Response('', { status: 302, headers: { location: 'https://169.254.169.254/latest/meta-data/' } }); } });
  assert.equal(calls, 1); assert.equal(r.limitation, 'redirect_not_allowed'); assert.deepEqual(r.excerpts, []);
});
test('unsupported content, denied access, oversize bodies and timeouts become explicit gaps', async () => {
  for (const [fetcher, limitation] of [
    [async () => new Response('pdf', { headers: { 'content-type': 'application/pdf' } }), 'unsupported_content_type'],
    [async () => new Response('private', { status: 403 }), 'http_403'],
    [async () => new Response('x'.repeat(400001), { headers: { 'content-type': 'text/html' } }), 'source_too_large'],
    [async () => { throw new DOMException('timeout', 'TimeoutError'); }, 'retrieval_failed_or_timed_out'],
  ]) {
    const r = await captureSource({ url }, '', { fetcher });
    assert.equal(r.status, 'unavailable'); assert.equal(r.limitation, limitation); assert.deepEqual(r.excerpts, []);
  }
});
test('an unsupported source never reaches the network', async () => {
  const r = await captureSource({ url: 'https://unknown.example/' }, '', { fetcher: () => { throw new Error('must not fetch'); } });
  assert.equal(r.limitation, 'unsupported_host_or_url');
});
test('source selection favors cited URLs, caps retrieval at three and reuses signed prior captures', async () => {
  const sources = Array.from({ length: 5 }, (_, i) => ({ url: 'https://arxiv.org/abs/' + i, access: 'cited_by_research' }));
  const prior = { source_url: sources[4].url, status: 'captured', excerpts: [{ id: 'old', text: 'actual retained evidence' }] };
  let calls = 0;
  const records = await collectSourceRecords({ assignment: { topic: 'evidence' }, report: '', sources, cited_urls: [sources[4].url], source_records: [prior] }, { fetcher: async () => { calls++; return response(); } });
  assert.equal(records.length, 3); assert.equal(records[0], prior); assert.equal(calls, 2);
});
test('excerpt selection preserves original character positions and bounds total retained text', () => {
  const text = ('irrelevant text '.repeat(200) + ' target Plato knowledge ' + 'supporting context '.repeat(200));
  const selected = selectExcerpts(text, 'target Plato knowledge');
  assert.ok(selected.some(e => e.text.includes('target Plato knowledge')));
  assert.ok(selected.length <= 4);
  for (const e of selected) { assert.equal(e.text, text.slice(e.start, e.end)); assert.ok(e.text.length <= 1100); }
});
test('identical content at different URLs gets source-bound excerpt IDs', async () => {
  const a = await captureSource({ url }, 'Plato', { fetcher: async () => response() });
  const b = await captureSource({ url: 'https://arxiv.org/abs/2207.05221' }, 'Plato', { fetcher: async () => response() });
  assert.equal(a.sha256, b.sha256);
  assert.notEqual(a.excerpts[0].id, b.excerpts[0].id);
});

test('supplemental capture retains earlier evidence outside the new three-source selection', async () => {
  const prior = { source_url: 'https://arxiv.org/abs/old', status: 'captured', excerpts: [{ id: 'retained', text: 'prior source content' }] };
  const sources = [1, 2, 3].map(i => ({ url: 'https://arxiv.org/abs/' + i, access: 'cited_by_research' }));
  let calls = 0;
  const records = await collectSourceRecords({ assignment: { topic: 'knowledge' }, sources, source_records: [prior] }, { fetcher: async () => { calls++; return response(); } });
  assert.equal(calls, 3);
  assert.equal(records.length, 4);
  assert.equal(records[3], prior);
});
