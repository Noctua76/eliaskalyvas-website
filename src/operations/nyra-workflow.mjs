// Separate HTTP requests keep each provider operation within the Edge runtime limit.
// Provider/network failures stop immediately; only an explicit editorial finding triggers repair.
export const MAX_REPAIR_CYCLES = 2;
export async function runEditorialWorkflow({ call, research, previousArticle, revisionNote = '', onPhase = () => {}, onResearch = () => {}, onDraft = () => {} }) {
  let r = research, prior = previousArticle, feedback = '';
  const history = [];
  for (let cycle = 0; cycle <= MAX_REPAIR_CYCLES; cycle++) {
    onPhase('draft');
    const d = await call('/draft', { ticket: r.ticket, ...(prior ? { previous_article: prior } : {}), revision_note: revisionNote, editorial_feedback: feedback });
    let version = { ...d, research: r, automatic_review: null, review_history: [...history], repair_cycles: cycle, article: { ...d.article, status: 'needs_revision' } };
    onDraft(version); // Preserve completed writing even if review fails or the next request times out.
    onPhase('review');
    const review = await call('/review', { ticket: r.ticket, article: d.article });
    history.push(review);
    version = { ...version, automatic_review: review, review_history: [...history], article: { ...d.article, status: review.passed ? 'pending_review' : 'needs_revision' } };
    onDraft(version);
    if (review.passed || cycle === MAX_REPAIR_CYCLES) return version;
    // Keep Elias's full instruction separate from generated repair notes on every revision.
    feedback = [review.revision_instructions, ...review.issues, review.research_questions].filter(Boolean).join('\n').slice(0, 5000);
    if (review.needs_research) {
      onPhase('research');
      r = await call('/research', { ...r.assignment, research_focus: feedback.slice(0, 3000) });
      onResearch(r);
      // New research may have a different verified URL set. Regenerate against that set.
      prior = undefined;
    } else prior = d.article;
  }
}
