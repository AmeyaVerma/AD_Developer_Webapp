import { createClient } from 'jsr:@supabase/supabase-js@2';

// Receives a 7/12 file (PDF, photo or Word), stores it privately and records it. No signature is required.
// Only this function writes upload records, so the browser cannot claim a document was uploaded or verified.
// (The function keeps its old name "verify-712" so the app does not have to change.)
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const MAX = 8 * 1024 * 1024;

const sha256Hex = async (u8: Uint8Array) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', u8))].map((b) => b.toString(16).padStart(2, '0')).join('');

// Identify the file by its first bytes, not by the name the uploader gave it.
function kind(b: Uint8Array): { ext: string; type: string } | null {
  if (b.length > 5 && String.fromCharCode(...b.subarray(0, 5)) === '%PDF-') return { ext: 'pdf', type: 'application/pdf' };
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: 'jpg', type: 'image/jpeg' };
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { ext: 'png', type: 'image/png' };
  if (b.length > 12 && String.fromCharCode(...b.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...b.subarray(8, 12)) === 'WEBP') return { ext: 'webp', type: 'image/webp' };
  // Word (.docx) is a zip with a word/ folder (a zip without one, e.g. a spreadsheet, is refused)
  if (b.length > 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04 && String.fromCharCode(...b.subarray(0, Math.min(b.length, 8192))).includes('word/')) return { ext: 'docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
  return null;
}

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
  const k = kind(bytes);
  if (!k) return reply(400, { error: 'Upload the 7/12 as a photo (JPG, PNG, WebP), a PDF or a Word (.docx) file.' });

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const sha256 = await sha256Hex(bytes);

  // A file that was rejected before cannot come back.
  const { data: rej } = await admin.from('rejections').select('verification_id').eq('sha256', sha256).limit(1);
  if (rej?.length) return reply(409, { status: 'rejected_before', reason: 'This 7/12 file was rejected earlier and cannot be uploaded again.', sha256 });

  // The same file cannot back two properties.
  const { data: same } = await admin.from('verifications').select('id').eq('sha256', sha256);
  if (same?.length) {
    const { data: used } = await admin.from('properties').select('id').in('verification_id', same.map((x: { id: string }) => x.id)).limit(1);
    if (used?.length) return reply(409, { status: 'duplicate', reason: 'This exact 7/12 file is already attached to a property.', sha256 });
  }

  const { data: row, error } = await admin.from('verifications').insert({
    sha256, status: 'uploaded', reason: 'Uploaded without a digital signature.', uploaded_by: who.user.id,
  }).select('id').single();
  if (error || !row) return reply(500, { error: 'Could not record the upload. Try again.' });

  const path = `${row.id}.${k.ext}`;
  const up = await admin.storage.from('originals').upload(path, bytes, { contentType: k.type, upsert: false });
  if (up.error) {
    await admin.from('verifications').delete().eq('id', row.id);
    return reply(500, { error: 'Could not store the file. Try again.' });
  }
  await admin.from('verifications').update({ file_path: path }).eq('id', row.id);

  return reply(200, { id: row.id, status: 'uploaded', reason: 'Uploaded without a digital signature.', sha256, file: path, canProceed: true });
});
