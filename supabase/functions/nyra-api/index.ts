import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { createWorkspaceHandler } from './lib/workspace.mjs';

// Separate from website-api: no calendar, mail, public routes or publication tools.
const env = Deno.env.toObject();
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
Deno.serve(createWorkspaceHandler({ db, env }));
