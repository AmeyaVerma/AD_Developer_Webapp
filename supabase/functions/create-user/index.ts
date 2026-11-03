import { createClient } from 'jsr:@supabase/supabase-js@2';

// Creates a login (Admin or Agent A/B/J/P). Only an existing Admin may call it; the service key never leaves this function.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply(405, { error: 'Method not allowed' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const authHeader = req.headers.get('Authorization') ?? '';
  const asCaller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });

  // 1. Who is calling, and are they an admin?
  const { data: who } = await asCaller.auth.getUser();
  if (!who?.user) return reply(401, { error: 'Not logged in.' });
  const { data: me } = await asCaller.from('profiles').select('role').eq('id', who.user.id).maybeSingle();
  if (me?.role !== 'admin') return reply(403, { error: 'Only an Admin can create accounts.' });

  // 2. Validate input
  let b: { email?: string; password?: string; role?: string; agent_code?: string };
  try { b = await req.json(); } catch { return reply(400, { error: 'Invalid request.' }); }
  const email = String(b.email ?? '').trim().toLowerCase();
  const password = String(b.password ?? '');
  const role = b.role;
  const agent = role === 'agent' ? String(b.agent_code ?? '') : null;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return reply(400, { error: 'Enter a valid email address.' });
  if (password.length < 8) return reply(400, { error: 'Password must be at least 8 characters.' });
  if (role !== 'admin' && role !== 'agent') return reply(400, { error: 'Choose Admin or Agent.' });
  if (role === 'agent' && !['A', 'B', 'J', 'P'].includes(agent ?? '')) return reply(400, { error: 'Choose the agent letter: A, B, J or P.' });

  // 3. Create the login and its profile (service key: server side only)
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  if (role === 'agent') {
    const { data: taken } = await admin.from('profiles').select('email').eq('agent_code', agent).maybeSingle();
    if (taken) return reply(409, { error: `Agent ${agent} already has a login (${taken.email}).` });
  }
  const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !created.user) {
    const dup = /already|registered|exists/i.test(error?.message ?? '');
    return reply(dup ? 409 : 400, { error: dup ? 'An account with this email already exists.' : (error?.message ?? 'Could not create the account.') });
  }
  const { error: pErr } = await admin.from('profiles').insert({ id: created.user.id, email, role, agent_code: agent });
  if (pErr) {
    await admin.auth.admin.deleteUser(created.user.id); // don't leave a login with no role
    return reply(500, { error: 'Could not set the role. Nothing was created.' });
  }
  return reply(200, { ok: true, email, role, agent_code: agent });
});
