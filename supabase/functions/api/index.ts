// THE HUNDRED — `api` Edge Function: the only write path for clients.
// 1. Verifies the caller's Supabase session (host login or anonymous player).
// 2. Calls public.api_exec(uid, action, args) with the service role. api_exec
//    enforces every rule (role, uses left, no self-heal, guess limits,
//    once-per-night Jester powers…) inside one locked transaction.
// Clients can't call api_exec themselves: it's revoked from anon/authenticated.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const URL = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Not signed in' }, 401);
  const { data: { user }, error: authErr } = await createClient(URL, ANON, { auth: { persistSession: false } }).auth.getUser(token);
  if (authErr || !user) return json({ error: 'Session expired — refresh the page' }, 401);

  let body: { action?: string; args?: Record<string, unknown> };
  try { body = await req.json(); } catch { return json({ error: 'Bad request' }, 400); }
  if (!body.action || typeof body.action !== 'string') return json({ error: 'Missing action' }, 400);

  const { data, error } = await admin.rpc('api_exec', { p_uid: user.id, p_action: body.action, p_args: body.args ?? {} });
  if (error) return json({ error: error.message }, 400);
  return json(data ?? { ok: true });
});
