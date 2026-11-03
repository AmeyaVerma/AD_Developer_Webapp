import { createClient } from 'jsr:@supabase/supabase-js@2';
import { inspectPdf } from './verifyPdf.mjs';

// Receives a 7/12 PDF, checks its digital signature on the server, stores the file and a verification record.
// Only this function can write verification records, so the browser can never claim a document is authentic.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const MAX = 8 * 1024 * 1024;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply(405, { error: 'Method not allowed' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const asCaller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const { data: who } = await asCaller.auth.getUser();
  if (!who?.user) return reply(401, { error: 'Not logged in.' });
  const { data: me } = await asCaller.from('profiles').select('role').eq('id', who.user.id).maybeSingle();
  if (!me) return reply(403, { error: 'This account has no access.' });

  const bytes = new Uint8Array(await req.arrayBuffer());
  if (!bytes.length || bytes.length > MAX) return reply(400, { error: 'The file is empty or larger than 8 MB.' });
  if (String.fromCharCode(...bytes.subarray(0, 5)) !== '%PDF-') return reply(400, { error: 'Upload the original 7/12 PDF. Photos and scans cannot be authenticated.' });

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: roots } = await admin.from('trusted_roots').select('pem');
  const r = await inspectPdf(bytes, (roots ?? []).map((x: { pem: string }) => x.pem));

  // A file that was rejected before cannot come back.
  const { data: rej } = await admin.from('rejections').select('verification_id').eq('sha256', r.sha256).limit(1);
  if (rej?.length) return reply(409, { status: 'rejected_before', reason: 'This 7/12 file was rejected earlier and cannot be uploaded again.', sha256: r.sha256 });

  // The same file cannot back two properties.
  const { data: same } = await admin.from('verifications').select('id').eq('sha256', r.sha256);
  if (same?.length) {
    const { data: used } = await admin.from('properties').select('id').in('verification_id', same.map((x: { id: string }) => x.id)).limit(1);
    if (used?.length) return reply(409, { status: 'duplicate', reason: 'This exact 7/12 file is already attached to a property.', sha256: r.sha256 });
  }

  const { data: row, error } = await admin.from('verifications').insert({
    sha256: r.sha256, status: r.status, reason: r.reason, signer: r.signer ?? null, issuer: r.issuer ?? null,
    signed_at: r.signedAt ?? null, uploaded_by: who.user.id,
  }).select('id').single();
  if (error || !row) return reply(500, { error: 'Could not record the check. Try again.' });

  const path = `${row.id}.pdf`;
  const up = await admin.storage.from('originals').upload(path, bytes, { contentType: 'application/pdf', upsert: false });
  if (up.error) {
    await admin.from('verifications').delete().eq('id', row.id);
    return reply(500, { error: 'Could not store the file. Try again.' });
  }
  await admin.from('verifications').update({ file_path: path }).eq('id', row.id);

  return reply(200, {
    id: row.id, status: r.status, reason: r.reason, detail: (r as { detail?: string }).detail ?? null, sha256: r.sha256, signer: r.signer ?? null, issuer: r.issuer ?? null, signedAt: r.signedAt ?? null,
    canProceed: r.status === 'authentic',
    adminCanOverride: me.role === 'admin' && r.status === 'unsigned',
  });
});
