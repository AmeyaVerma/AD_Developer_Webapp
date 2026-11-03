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
