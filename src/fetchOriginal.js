// Opens the Mahabhulekh 7/12 form for a person to finish. The details go in the part of the address after "#", which is
// never sent to any server; the fill-in helper extension (see /extension) reads them, fills the form and leaves the
// captcha and Submit to the person. Without the extension the site simply opens and the app's copy buttons still work.
export const MAHABHULEKH = 'https://bhulekh.mahabhumi.gov.in/';

const b64url = (obj) => btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** mr = { district, taluka, village } as written on the 7/12 (Marathi); gat; phone = the person's own 10-digit number. */
export function openMahabhulekh({ mr = {}, gat = '', phone = '' }) {
  const payload = { d: mr.district || '', t: mr.taluka || '', v: mr.village || '', g: gat || '', m: /^\d{10}$/.test(phone) ? phone : '' };
  window.open(`${MAHABHULEKH}#adp=${b64url(payload)}`, '_blank', 'noopener');
}
