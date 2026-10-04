import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { createHandler } from './lib/api.mjs';

const env: Record<string, any> = Deno.env.toObject();
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
// Calendar refresh tokens are kept encrypted by Supabase Vault, never in a public table.
env.saveRefreshToken = async (provider: string, token: string) => {
  const { error } = await db.rpc('website_store_calendar_token', { p_provider: provider, p_token: token });
  if (error) throw new Error('TOKEN_PERSISTENCE_FAILED');
};
const handler = createHandler({ db, env });
Deno.serve(async (req) => {
  // A rotated token may supersede the deployment secret; load it before provider use.
  const { data, error } = await db.rpc('website_calendar_tokens');
  if (error) return Response.json({ error: 'STORAGE_UNAVAILABLE' }, { status: 503 });
  for (const row of data || []) env[row.provider + '_REFRESH_TOKEN'] = row.token;
  return handler(req);
});
