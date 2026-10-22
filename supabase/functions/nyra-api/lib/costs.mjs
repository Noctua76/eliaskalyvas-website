// USD, Standard short-context pricing verified 2026-10-22. Estimates, not invoices.
export const PRICE_DATE = '2026-10-22';
export const MODELS = {
  'gpt-6.1-sol': { label: 'GPT-6.1 Sol', input: 2, cached: .10, write: 2.5, output: 10 },
  'gpt-6-astra': { label: 'GPT-6 Astra', input: 10, cached: 1, write: 12.5, output: 50 },
  'gpt-6-luna': { label: 'GPT-6 Luna', input: .10, cached: .01, write: .125, output: .50 },
};
const round = n => Math.ceil(n * 1e6 - 1e-9) / 1e6;
export function usageCost(model, response) {
  const price = MODELS[model], u = response?.usage;
  if (!price || !u || !Number.isFinite(u.input_tokens) || !Number.isFinite(u.output_tokens)) return null;
  const cached = u.input_tokens_details?.cached_tokens || 0, writes = u.input_tokens_details?.cache_write_tokens || 0;
  if (cached + writes > u.input_tokens) return null;
  // Count reported web search actions conservatively, including opens. Provider invoice is authoritative.
  const searches = (response.output || []).filter(x => x.type === 'web_search_call').length;
  return { usd: round(((u.input_tokens - cached - writes) * price.input + cached * price.cached + writes * price.write + u.output_tokens * price.output) / 1e6 + searches * .01), input_tokens: u.input_tokens, output_tokens: u.output_tokens, cached_tokens: cached, cache_write_tokens: writes, reasoning_tokens: u.output_tokens_details?.reasoning_tokens || 0, search_calls: searches, price_date: PRICE_DATE };
}
export function stageEstimate(model, stage, input) {
  if (stage === 'evidence') return 0;
  const p = MODELS[model]; if (!p) throw new Error('INVALID_MODEL');
  const search = ['research', 'proposals'].includes(stage);
  const bytes = new TextEncoder().encode(JSON.stringify(input)).length;
  // Byte-based input allowance plus search-content allowance. Search volume can exceed this estimate.
  return round(((bytes + 20000 + (search ? 150000 : 0)) * p.write + (stage === 'draft' ? 12000 : 5000) * p.output) / 1e6 + (search ? .08 : 0));
}
