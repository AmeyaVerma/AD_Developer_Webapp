// Sends a 7/12 PDF to the server for its digital-signature check. The server writes the result; this file only asks.
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabase } from './supabase';

/** Resolves to { httpStatus, status, reason, id, canProceed, adminCanOverride, signer, signedAt, error }. */
export async function verifyFile(file) {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return { httpStatus: 401, error: 'You are logged out. Log in again.' };
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/verify-712`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${data.session.access_token}`, apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/pdf' },
      body: file,
    });
    const j = await r.json().catch(() => ({}));
    return { httpStatus: r.status, ...j };
  } catch (e) {
    return { httpStatus: 0, error: 'Could not reach the verification service. Check your connection and try again.' };
  }
}

/** Admin only: accept an unsigned copy after checking its 16-digit number on the government portal. */
export async function adminOverride(id, verificationNo, note) {
  const { data: u } = await supabase.auth.getUser();
  if (!u?.user) return 'You are logged out. Log in again.';
  const { error } = await supabase.from('verifications').update({
    status: 'admin_verified', verification_no: String(verificationNo).replace(/\s+/g, ''), override_by: u.user.id, override_note: note,
  }).eq('id', id);
  return error ? 'Could not record the verification. Check the 16-digit number and add a short note.' : null;
}
