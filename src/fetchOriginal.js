// Opens the Mahabhulekh 7/12 form in a small popup window for a person to finish. The details go in the part of the
// address after "#", which is never sent to any server. The fill-in helper extension (see /extension) reads them, fills the
// form and leaves the captcha and Submit to the person; afterwards its "Send this record" button returns the record to the
// app through a one-time upload link made here (good for one file, for this document only).
// Without the extension the site simply opens and the app's copy buttons still work.
import { SUPABASE_ANON_KEY, SUPABASE_ON, supabase } from './supabase';

export const MAHABHULEKH = 'https://bhulekh.mahabhumi.gov.in/';

const b64url = (obj) => btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/**
 * mr = { district, taluka, village } as written on the 7/12 (Marathi); gat; phone = the person's own 10-digit number;
 * vid = the uploaded document's record id (where the returned record is stored).
 * Resolves to { sendBack } — true when a one-time upload link was created.
 */
export async function openMahabhulekh({ mr = {}, gat = '', phone = '', vid = '' }) {
  // open the window right away, inside the click, so popup blockers allow it
  const win = window.open('about:blank', 'adp_mahabhulekh', 'popup=yes,width=560,height=880,left=40,top=40');
  if (win) win.opener = null;
  let u = '', k = '';
  if (SUPABASE_ON && vid) {
    const { data } = await supabase.storage.from('govt-originals').createSignedUploadUrl(`${vid}/helper-${Date.now()}.pdf`);
    if (data?.signedUrl) { u = data.signedUrl; k = SUPABASE_ANON_KEY; }
  }
  const payload = { d: mr.district || '', t: mr.taluka || '', v: mr.village || '', g: gat || '', m: /^\d{10}$/.test(phone) ? phone : '', u, k };
  const url = `${MAHABHULEKH}#adp=${b64url(payload)}`;
  if (win) win.location.href = url; else window.open(url, '_blank');
  return { sendBack: !!u };
}
