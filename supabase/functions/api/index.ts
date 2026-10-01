// THE HUNDRED — `api` Edge Function: the only write path for clients.
// 1. Verifies the caller's Supabase session (host login or anonymous player).
// 2. Calls public.api_exec(uid, action, args) with the service role. api_exec
//    enforces every rule (role, uses left, no self-heal, guess limits,
//    once-per-night Jester powers…) inside one locked transaction.
// Clients can't call api_exec themselves: it's revoked from anon/authenticated.
//
// Optional env (supabase secrets set NAME=value):
//   HOST_EMAILS    comma-separated host emails. When set, any NON-anonymous user whose
//                  email isn't listed is refused, so a stranger who signs up an email
//                  account can't create rooms. Players are anonymous and unaffected.
//   ALLOWED_ORIGIN the site origin (e.g. https://gammonbeastshundred.netlify.app).
//                  Defaults to '*'; safe either way, because auth is a bearer token, not a cookie.
import { createClient } from 'npm:@supabase/supabase-js@2';

const ORIGIN = Deno.env.get('ALLOWED_ORIGIN')?.trim() || '*';
const cors = {
  'Access-Control-Allow-Origin': ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  ...(ORIGIN === '*' ? {} : { Vary: 'Origin' }),
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const URL = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
const authClient = createClient(URL, ANON, { auth: { persistSession: false } });

const HOSTS = new Set((Deno.env.get('HOST_EMAILS') ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
const MAX_BODY = 256 * 1024;                  // Test Lab bot selfies are ~1 KB SVGs each; real calls are tiny
const ACTION = /^[a-z][a-z0-9_]{0,63}$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Not signed in' }, 401);
  const { data: { user }, error: authErr } = await authClient.auth.getUser(token);
  if (authErr || !user) return json({ error: 'Session expired — refresh the page' }, 401);
  if (HOSTS.size && !user.is_anonymous && !HOSTS.has((user.email ?? '').toLowerCase())) {
    return json({ error: 'This account is not a host' }, 403);
  }

  // Bounded body read: refuse anything huge before parsing it.
  const declared = Number(req.headers.get('Content-Length') ?? '0');
  if (declared > MAX_BODY) return json({ error: 'Request too large' }, 413);
  let raw: string;
  try { raw = await req.text(); } catch { return json({ error: 'Bad request' }, 400); }
  if (raw.length > MAX_BODY) return json({ error: 'Request too large' }, 413);

  let body: { action?: unknown; args?: unknown };
  try { body = JSON.parse(raw); } catch { return json({ error: 'Bad request' }, 400); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Bad request' }, 400);
  if (typeof body.action !== 'string' || !ACTION.test(body.action)) return json({ error: 'Missing action' }, 400);
  const args = body.args ?? {};
  if (typeof args !== 'object' || args === null || Array.isArray(args)) return json({ error: 'Bad arguments' }, 400);

  const { data, error } = await admin.rpc('api_exec', { p_uid: user.id, p_action: body.action, p_args: args });
  if (error) return json({ error: error.message }, 400);
  return json(data ?? { ok: true });
});
