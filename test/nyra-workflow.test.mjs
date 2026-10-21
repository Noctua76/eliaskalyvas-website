import test from 'node:test';
import assert from 'node:assert/strict';
import { runEditorialWorkflow } from '../src/operations/nyra-workflow.mjs';

const assignment = { topic: 'judgment', direction: 'original angle', language: 'gr', format: 'signal' };
const research = { ticket: 'signed-1', assignment };
const draft = n => ({ run: { id: 'draft-' + n }, article: { title: 'Article ' + n, status: 'needs_revision' } });
const review = (passed, needsResearch = false) => ({ passed, needs_research: needsResearch, issues: passed ? [] : ['Explain the finding plainly.'], revision_instructions: passed ? '' : 'Simplify paragraph 3.', research_questions: needsResearch ? 'Check the correction.' : '' });
function fake(outputs) {
  const requests = [], versions = [], phases = [], researches = [];
  return { requests, versions, phases, researches, options: {
    research, onDraft: d => versions.push(d), onPhase: p => phases.push(p), onResearch: r => researches.push(r),
    call: async (path, payload) => { requests.push({ path, payload }); const result = outputs.shift(); if (result instanceof Error) throw result; assert.ok(result, 'unexpected extra call'); return result; },
  } };
}
test('passing initial draft stops after review and still requires Elias', async () => {
  const s = fake([draft(1), review(true)]), d = await runEditorialWorkflow(s.options);
  assert.deepEqual(s.requests.map(x => x.path), ['/draft', '/review']);
  assert.equal(d.article.status, 'pending_review'); assert.equal(d.repair_cycles, 0);
  assert.equal(s.versions[0].automatic_review, null); assert.equal(s.versions[0].article.status, 'needs_revision');
});
test('editorial findings trigger revision; two repair cycles are a hard workflow bound', async () => {
  const s = fake([draft(1), review(false), draft(2), review(false), draft(3), review(false)]);
  const d = await runEditorialWorkflow({ ...s.options, revisionNote: 'Keep my perspective.' });
  assert.equal(s.requests.length, 6); assert.equal(d.repair_cycles, 2);
  assert.equal(d.article.status, 'needs_revision'); assert.equal(d.review_history.length, 3);
  assert.equal(s.requests[2].payload.previous_article.title, 'Article 1');
  assert.ok(s.requests[4].payload.revision_note.includes('Keep my perspective.'));
});
test('evidence gaps trigger fresh research with original assignment and then a new sourced draft', async () => {
  const fresh = { ...research, ticket: 'signed-2' };
  const s = fake([draft(1), review(false, true), fresh, draft(2), review(true)]);
  const d = await runEditorialWorkflow(s.options);
  assert.deepEqual(s.requests.map(x => x.path), ['/draft', '/review', '/research', '/draft', '/review']);
  assert.deepEqual(s.requests[2].payload.topic, assignment.topic);
  assert.ok(s.requests[2].payload.research_focus.includes('Check the correction.'));
  assert.equal(s.requests[3].payload.ticket, 'signed-2'); assert.equal(s.requests[3].payload.previous_article, undefined);
  assert.equal(d.research.ticket, 'signed-2'); assert.equal(d.repair_cycles, 1);
});
test('review timeout preserves writing, remains incomplete, and never starts a paid retry', async () => {
  const s = fake([draft(1), new Error('PROVIDER_TIMEOUT')]);
  await assert.rejects(runEditorialWorkflow(s.options), /PROVIDER_TIMEOUT/);
  assert.equal(s.requests.length, 2); assert.equal(s.versions.length, 1);
  assert.equal(s.versions[0].article.status, 'needs_revision'); assert.equal(s.versions[0].automatic_review, null);
});
test('two research repairs stop with unresolved findings, without a third research request', async () => {
  const s = fake([draft(1), review(false, true), research, draft(2), review(false, true), research, draft(3), review(false, true)]);
  const d = await runEditorialWorkflow(s.options);
  assert.equal(s.requests.filter(x => x.path === '/research').length, 2);
  assert.equal(d.article.status, 'needs_revision'); assert.equal(d.automatic_review.needs_research, true);
});
