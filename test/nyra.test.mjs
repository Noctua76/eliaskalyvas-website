import test from 'node:test';
import assert from 'node:assert/strict';
import { createNyraHandler, seal, unseal, extractEvidence, validateArticle, assignmentPayload, validateReview } from '../supabase/functions/nyra-api/lib/api.mjs';
import { PROMPT_VERSION } from '../supabase/functions/nyra-api/lib/instructions.mjs';
import { fixture } from './fixture.mjs';

const ownerId = 'dad84105-d898-4194-bbe1-721a2636e543';
const env = { NYRA_ENABLED: 'true', OPENAI_API_KEY: 'test-key-never-real', NYRA_MODEL: 'test-model', ALLOWED_ORIGINS: 'https://eliaskalyvas.gr' };
const source = 'https://arxiv.org/abs/2207.05221';
const assignment = { topic: 'AI and judgment', direction: '', language: 'gr', format: 'signal' };
const jwt = (aal = 'aal2') => 'header.' + Buffer.from(JSON.stringify({ aal })).toString('base64url') + '.signature';
const article = (words = 600) => ({ title: 'Judgment', summary: 'A summary', thesis: 'A thesis', original_contribution: 'An original question', counterargument: 'A counterargument', paragraphs: [{ text: Array(words).fill('λέξη').join(' '), source_urls: [source] }], uncertainties: [], editor_note: 'Human editorial review required.' });
const researchOutput = () => ({ id: 'research-1', status: 'completed', usage: { input_tokens: 20, output_tokens: 30 }, output: [
  { id: 'search-1', type: 'web_search_call', status: 'completed', action: { type: 'search', queries: ['AI judgment'], sources: [{ type: 'url', url: source }] } },
  { id: 'open-1', type: 'web_search_call', status: 'completed', action: { type: 'open_page', url: source } },
  { type: 'message', content: [{ type: 'output_text', text: 'An evidence report [1].', annotations: [{ type: 'url_citation', url: source, title: 'Original study', start_index: 19, end_index: 22 }] }] },
] });
const draftOutput = (a = article()) => ({ id: 'draft-1', status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(a) }] }], usage: { input_tokens: 40, output_tokens: 50 } });
function setup({ membership = true, auth = true, rate = true, config = {}, outputs = [researchOutput(), draftOutput()], sourceFetcher = async () => new Response('<html><body><h1>Original study</h1><p>' + 'Original primary source evidence and limitations. '.repeat(20) + '</p></body></html>', { headers: { 'content-type': 'text/html' } }) } = {}) {
  const requests = [], rpcs = [], tokens = [], lookups = [];
  const db = {
    auth: { getUser: async token => { tokens.push(token); return { data: auth ? { user: { id: ownerId } } : null, error: auth ? null : { message: 'invalid' } }; } },
    from: table => {
      assert.equal(table, 'website_owners');
      return { select: column => ({ eq: (field, id) => ({ maybeSingle: async () => { lookups.push({ column, field, id }); return { data: membership ? { user_id: id } : null, error: null }; } }) }) };
    },
    rpc: async (name, args) => { rpcs.push({ name, args }); return { data: rate, error: null }; },
  };
  const fetcher = async (url, init) => {
    requests.push({ url, ...init, payload: JSON.parse(init.body) });
    const output = outputs.shift();
    if (output instanceof Error) throw output;
    if (output instanceof Response) return output;
    return Response.json(output);
  };
  const handler = createNyraHandler({ db, env: { ...env, ...config }, fetcher, sourceFetcher });
  const call = async (path, body, headers = {}, token = jwt()) => {
    const req = new Request('https://project.supabase.co/functions/v1/nyra-api' + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Origin: 'https://eliaskalyvas.gr', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const response = await handler(req);
    return { response, data: await response.json() };
  };
  return { handler, call, requests, rpcs, tokens, lookups };
}
test('Nyra research and draft use owner/MFA auth and return traceable, unpublished output', async () => {
  const s = setup();
  const r = await s.call('/research', assignment);
  assert.equal(r.response.status, 200); assert.ok(r.data.ticket);
  assert.equal(r.data.sources[0].access, 'opened_page');
  const d = await s.call('/draft', { ticket: r.data.ticket });
  assert.equal(d.response.status, 200); assert.equal(d.data.article.word_count, 600);
  assert.equal(d.data.article.status, 'needs_revision'); assert.equal(d.data.publishing, false);
  assert.equal(d.data.run.prompt_version, PROMPT_VERSION);
  assert.equal(s.requests.length, 2); assert.equal(s.lookups.length, 2);
  assert.ok(s.tokens.every(t => t === jwt()));
  assert.ok(s.requests.every(r => r.url === 'https://api.openai.com/v1/responses' && r.payload.store === false));
  assert.equal(s.requests[0].payload.tool_choice, 'required');
  assert.deepEqual(s.requests[0].payload.tools, [{ type: 'web_search' }]);
  assert.equal(s.requests[1].payload.tools, undefined);
  assert.equal(s.requests[1].payload.text.format.strict, true);
  assert.equal(s.rpcs[0].name, 'website_rate_check');
});
test('authentication failures never invoke OpenAI', async t => {
  for (const scenario of [
    { name: 'no token', token: null, options: {}, code: 401 },
    { name: 'invalid token', token: jwt(), options: { auth: false }, code: 401 },
    { name: 'non-owner AAL2 user', token: jwt(), options: { membership: false }, code: 403 },
    { name: 'owner without MFA', token: jwt('aal1'), options: {}, code: 403 },
  ]) await t.test(scenario.name, async () => {
    const s = setup(scenario.options), r = await s.call('/research', assignment, {}, scenario.token);
    assert.equal(r.response.status, scenario.code); assert.equal(s.requests.length, 0); assert.equal(s.rpcs.length, 0);
  });
});
test('untrusted origins are rejected before authentication or provider calls', async () => {
  const s = setup(), r = await s.call('/research', assignment, { Origin: 'https://attacker.example' });
  assert.equal(r.response.status, 403); assert.equal(s.tokens.length, 0); assert.equal(s.requests.length, 0);
  assert.equal(r.response.headers.get('access-control-allow-origin'), null);
});
test('configuration status requires owner MFA and does not imply provider acceptance', async () => {
  const s = setup(), r = await s.call('/status');
  assert.equal(r.response.status, 200); assert.equal(r.data.enabled, true); assert.equal(r.data.publishing, false);
  assert.equal(r.data.persistence, 'session_only'); assert.equal(r.data.social_monitoring, false);
  assert.equal(s.requests.length, 0);
  assert.equal((await s.call('/status', undefined, {}, null)).response.status, 401);
});
test('disabled or missing configuration cannot consume API credits', async t => {
  for (const config of [{ NYRA_ENABLED: 'false' }, { OPENAI_API_KEY: '' }, { NYRA_MODEL: '' }]) await t.test(JSON.stringify(config), async () => {
    const s = setup({ config });
    assert.equal((await s.call('/status')).data.enabled, false);
    assert.equal((await s.call('/research', assignment)).data.error, 'NYRA_NOT_CONFIGURED');
    assert.equal(s.requests.length, 0);
  });
});
test('publishing and arbitrary routes do not exist', async () => {
  const s = setup();
  for (const path of ['/publish', '/reject', '/worker', '/comments', '/research/extra']) assert.equal((await s.call(path, {})).response.status, 404);
  assert.equal(s.requests.length, 0);
});
test('malformed assignment, invalid language and overlong inputs fail before billing', async () => {
  const s = setup();
  for (const a of [{ ...assignment, topic: '' }, { ...assignment, language: 'fr' }, { ...assignment, format: 'book' }, { ...assignment, topic: 'a'.repeat(4001) }, []]) {
    assert.equal((await s.call('/research', a)).response.status, 400);
  }
  assert.equal(s.requests.length, 0);
  assert.throws(() => assignmentPayload(null));
});
test('rate limit fails closed before provider billing', async () => {
  const s = setup({ rate: false }), r = await s.call('/research', assignment);
  assert.equal(r.response.status, 429); assert.equal(s.requests.length, 0);
});
test('server model and tools cannot be replaced by assignment fields', async () => {
  const s = setup();
  await s.call('/research', { ...assignment, model: 'attacker-model', tools: [{ type: 'function' }] });
  assert.equal(s.requests[0].payload.model, 'test-model');
  assert.deepEqual(JSON.parse(s.requests[0].payload.input).assignment, assignment);
});
test('signed research rejects tampering, changed owner, expiry and version changes', async () => {
  const packet = { owner_id: ownerId, prompt_version: PROMPT_VERSION, expires_at: 2000, assignment };
  const ticket = await seal(packet, env.OPENAI_API_KEY);
  assert.deepEqual(await unseal(ticket, env.OPENAI_API_KEY, ownerId, 1000), packet);
  await assert.rejects(unseal(ticket, env.OPENAI_API_KEY, 'other-owner', 1000));
  await assert.rejects(unseal(ticket, env.OPENAI_API_KEY, ownerId, 2000));
  await assert.rejects(unseal(ticket, 'rotated-key', ownerId, 1000));
  const [payload, signature] = ticket.split('.');
  const tampered = JSON.parse(Buffer.from(payload, 'base64url')); tampered.assignment.topic = 'Change evidence';
  await assert.rejects(unseal(Buffer.from(JSON.stringify(tampered)).toString('base64url') + '.' + signature, env.OPENAI_API_KEY, ownerId, 1000));
  await assert.rejects(unseal(await seal({ ...packet, prompt_version: 'old' }, env.OPENAI_API_KEY), env.OPENAI_API_KEY, ownerId, 1000));
});
test('invalid research ticket cannot reach drafting provider', async () => {
  const s = setup(), r = await s.call('/draft', { ticket: 'fabricated.ticket' });
  assert.equal(r.response.status, 409); assert.equal(s.requests.length, 0);
});
test('a server model change invalidates existing evidence before drafting', async () => {
  const r = await setup().call('/research', assignment);
  const s = setup({ config: { NYRA_MODEL: 'changed-model' } });
  assert.equal((await s.call('/draft', { ticket: r.data.ticket })).response.status, 409);
  assert.equal(s.requests.length, 0);
});
test('research without actual search calls and traceable URLs is withheld', async () => {
  const output = { ...researchOutput(), output: [{ type: 'message', content: [{ type: 'output_text', text: 'I searched, trust me.' }] }] };
  const s = setup({ outputs: [output] });
  assert.equal((await s.call('/research', assignment)).data.error, 'RESEARCH_WITHOUT_SOURCES');
  assert.equal(s.requests.length, 1);
});
test('search-only evidence is not labeled as an opened source and unsafe URLs are discarded', () => {
  const r = researchOutput(); r.output = r.output.filter(x => x.id !== 'open-1');
  r.output[0].action.sources.push({ url: 'javascript:alert(1)' }, { url: 'https://user:pass@example.com/' });
  const evidence = extractEvidence(r);
  assert.equal(evidence.sources.length, 1); assert.equal(evidence.sources[0].access, 'cited_by_research');
});
test('fabricated citations and sources without citations cannot pass draft validation', () => {
  const a = article(); a.paragraphs[0].source_urls = ['https://fabricated.example/'];
  assert.throws(() => validateArticle(a, [{ url: source }], 'signal'), /UNVERIFIED_CITATION/);
  a.paragraphs[0].source_urls = ['javascript:alert(1)'];
  assert.throws(() => validateArticle(a, [{ url: source }], 'signal'), /UNVERIFIED_CITATION/);
  a.paragraphs[0].source_urls = [];
  assert.throws(() => validateArticle(a, [{ url: source }], 'signal'), /ARTICLE_WITHOUT_CITATIONS/);
});
test('out-of-range length produces a visible revision requirement, never publication', () => {
  assert.equal(validateArticle(article(100), [{ url: source }], 'signal').status, 'needs_revision');
  assert.equal(validateArticle(article(1500), [{ url: source }], 'essay').checks.length, true);
  assert.equal(validateArticle(article(1500), [{ url: source }], 'signal').checks.length, false);
});
test('revision keeps signed assignment, research, language and format without tools', async () => {
  const s = setup(), r = await s.call('/research', assignment);
  const d = await s.call('/draft', { ticket: r.data.ticket, previous_article: article(), revision_note: 'Use simpler language.', assignment: { language: 'en' } });
  assert.equal(d.response.status, 200);
  const input = JSON.parse(s.requests[1].payload.input);
  assert.deepEqual(input.assignment, assignment); assert.equal(input.revision_note, 'Use simpler language.');
  assert.equal(input.previous_article.paragraphs[0].text, article().paragraphs[0].text);
  assert.equal(s.requests[1].payload.tools, undefined);
});
test('provider errors are sanitized and never automatically retried', async t => {
  for (const [output, expected] of [
    [new Response('secret credentials and unpublished data', { status: 401 }), 'PROVIDER_CONFIGURATION'],
    [new Response('secret account info', { status: 429 }), 'PROVIDER_LIMIT'],
    [new DOMException('private timeout details', 'TimeoutError'), 'PROVIDER_TIMEOUT'],
    [{ ...researchOutput(), status: 'incomplete' }, 'MODEL_INCOMPLETE'],
    [{ ...researchOutput(), output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'private refusal' }] }] }, 'MODEL_REFUSED'],
  ]) await t.test(expected, async () => {
    const s = setup({ outputs: [output] }), r = await s.call('/research', assignment);
    assert.equal(r.data.error, expected); assert.equal(s.requests.length, 1);
    assert.ok(!JSON.stringify(r.data).includes('secret')); assert.ok(!JSON.stringify(r.data).includes('private'));
  });
});
test('payloads are bounded even without a content-length header', async () => {
  const s = setup(), r = await s.call('/research', { ...assignment, direction: 'x'.repeat(263000) });
  assert.equal(r.response.status, 413); assert.equal(s.requests.length, 0);
});
test('credential-free CORS preflight does not execute owner lookup or model', async () => {
  const s = setup(), response = await s.handler(new Request('https://test/nyra-api/research', { method: 'OPTIONS', headers: { Origin: 'https://eliaskalyvas.gr' } }));
  assert.equal(response.status, 204); assert.equal(s.tokens.length, 0);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://eliaskalyvas.gr');
});
test('the existing PostgreSQL rate counter persists the Nyra owner limit across requests', async () => {
  const { db, pg } = await fixture();
  try {
    const args = { p_bucket: 'nyra-lab:' + ownerId + ':research', p_limit: 3 };
    for (let i = 0; i < 3; i++) assert.equal((await db.rpc('website_rate_check', args)).data, true);
    assert.equal((await db.rpc('website_rate_check', args)).data, false);
    assert.equal((await db.rpc('website_rate_check', { ...args, p_bucket: 'nyra-lab:' + ownerId + ':draft', p_limit: 6 })).data, true);
  } finally { await pg.close(); }
});

const reviewResult = (changes = {}) => ({ checks: { clarity: true, coherence: true, editorial_contribution: true, counterargument: true, evidence: true }, needs_research: false, issues: [], revision_instructions: '', research_questions: '', ...changes });
test('review uses owner MFA, signed research and server tools configuration', async () => {
  const s = setup({ outputs: [researchOutput(), draftOutput(reviewResult())] });
  const r = await s.call('/research', assignment);
  const result = await s.call('/review', { ticket: r.data.ticket, article: article(), tools: [{ type: 'web_search' }] });
  assert.equal(result.response.status, 200); assert.equal(result.data.passed, false); // Metadata alone cannot establish excerpt support.
  assert.equal(result.data.approval, 'human_required'); assert.equal(result.data.publishing, false);
  assert.equal(s.requests[1].payload.tools, undefined);
  assert.equal(s.requests[1].payload.text.format.name, 'nyra_review');
  assert.equal(s.rpcs[1].args.p_bucket, 'nyra-lab:' + ownerId + ':review');
  assert.equal((await s.call('/review', { ticket: r.data.ticket, article: article() }, {}, jwt('aal1'))).response.status, 403);
  assert.equal((await s.call('/review', { ticket: 'invalid', article: article() })).response.status, 409);
  assert.equal(s.requests.length, 2);
});
test('review cannot override server length and recorded access gaps with a passing verdict', () => {
  const a = validateArticle(article(100), [{ url: source }], 'signal');
  const r = validateReview(reviewResult(), a, [{ url: source, access: 'cited_by_research' }], 'gr');
  assert.equal(r.passed, false); assert.equal(r.needs_research, true);
  assert.equal(r.checks.length, false); assert.equal(r.checks.recorded_source_access, false);
  assert.deepEqual(r.access_gaps, [source]); assert.equal(r.issues.length, 2);
});
test('incomplete and failed opens never become recorded completed page access', () => {
  for (const status of ['searching', 'failed', 'incomplete']) {
    const r = researchOutput(); r.output.find(x => x.id === 'open-1').status = status;
    assert.notEqual(extractEvidence(r).sources[0].access, 'opened_page');
  }
});
test('cited sources survive the discovery result cap', () => {
  const r = researchOutput();
  r.output[0].action.sources = Array.from({ length: 70 }, (_, i) => ({ url: 'https://example.org/discovery/' + i }));
  const evidence = extractEvidence(r);
  assert.equal(evidence.sources.length, 60);
  assert.ok(evidence.sources.some(s => s.url === source && s.access === 'opened_page'));
});
test('invalid reviews fail closed; missing evidence requests research', () => {
  const a = validateArticle(article(), [{ url: source }], 'signal');
  for (const invalid of [null, {}, reviewResult({ issues: ['x'.repeat(1001)] }), reviewResult({ needs_research: 'false' })]) assert.throws(() => validateReview(invalid, a, [], 'en'));
  const r = validateReview(reviewResult({ checks: { ...reviewResult().checks, evidence: false } }), a, [{ url: source, access: 'opened_page' }], 'en');
  assert.equal(r.passed, false); assert.equal(r.needs_research, true);
});
test('review provider failures stop without automatic retry or secret disclosure', async () => {
  const s = setup({ outputs: [researchOutput(), new Response('private account body', { status: 429 })] });
  const r = await s.call('/research', assignment);
  const result = await s.call('/review', { ticket: r.data.ticket, article: article() });
  assert.equal(result.data.error, 'PROVIDER_LIMIT'); assert.equal(s.requests.length, 2);
  assert.ok(!JSON.stringify(result.data).includes('private'));
});
test('evidence retrieval is owner-bound and incurs no provider call; captured IDs travel into drafting and review', async () => {
  const s = setup({ outputs: [researchOutput(), draftOutput(), draftOutput(reviewResult())] });
  const r = await s.call('/research', assignment);
  const e = await s.call('/evidence', { ticket: r.data.ticket });
  assert.equal(e.response.status, 200); assert.equal(s.requests.length, 1);
  assert.equal(e.data.source_records[0].status, 'captured'); assert.equal(e.data.evidence_ready, true);
  const packet = await unseal(e.data.ticket, env.OPENAI_API_KEY, ownerId);
  assert.equal(packet.source_records[0].excerpts[0].text, e.data.source_records[0].excerpts[0].text);
  const d = await s.call('/draft', { ticket: e.data.ticket });
  const input = JSON.parse(s.requests[1].payload.input);
  assert.equal(input.source_records[0].sha256, packet.source_records[0].sha256);
  const a = d.data.article; a.paragraphs[0].evidence_ids = [packet.source_records[0].excerpts[0].id];
  const reviewed = await s.call('/review', { ticket: e.data.ticket, article: a });
  assert.equal(reviewed.data.passed, true); assert.equal(reviewed.data.approval, 'human_required');
  assert.equal(JSON.parse(s.requests[2].payload.input).presentation.source_list_rendered_by_application, true);
  assert.equal((await s.call('/evidence', { ticket: 'tampered' })).response.status, 409);
  assert.equal((await s.call('/evidence', { ticket: e.data.ticket }, {}, jwt('aal1'))).response.status, 403);
});
test('invented evidence IDs or IDs belonging to a different cited source are rejected', () => {
  const records = [{ source_url: source, status: 'captured', excerpts: [{ id: 'receipt:1', text: 'source content' }] }];
  const a = article(); a.paragraphs[0].evidence_ids = ['invented'];
  assert.throws(() => validateArticle(a, [{ url: source }], 'signal', records), /UNVERIFIED_EXCERPT/);
  a.paragraphs[0].evidence_ids = ['receipt:1']; a.paragraphs[0].source_urls = ['https://arxiv.org/abs/other'];
  assert.throws(() => validateArticle(a, [{ url: 'https://arxiv.org/abs/other' }], 'signal', records), /UNVERIFIED_EXCERPT/);
});
test('fresh research receives earlier captured evidence and rejects changed assignment before billing', async () => {
  const s = setup({ outputs: [researchOutput(), researchOutput()] });
  const r = await s.call('/research', assignment), e = await s.call('/evidence', { ticket: r.data.ticket });
  const next = await s.call('/research', { ...assignment, previous_ticket: e.data.ticket, research_focus: 'Check a specific claim.' });
  assert.equal(next.response.status, 200);
  assert.equal(JSON.parse(s.requests[1].payload.input).existing_evidence[0].status, 'captured');
  assert.equal((await s.call('/research', { ...assignment, topic: 'different', previous_ticket: e.data.ticket })).response.status, 400);
  assert.equal(s.requests.length, 2);
});
