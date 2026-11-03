// Outside-source checks for a 7/12. A green tick on a field means the value was confirmed by a source other than the
// document itself: the cadastral map (automatic, where we hold the village map) or an official site checked by Admin
// (with a note and optional receipt). The document's own digital signature is shown separately.
import { findParcel, library } from './pipeline/library';
import { enDistrict, enTaluka } from './pipeline/parse712';
import { supabase } from './supabase';

export const SOURCES = {
  map: { label: 'Cadastral map', site: 'Mahabhunakasha', link: 'https://mahabhunakasha.mahabhumi.gov.in/', hint: 'Find the village and Gat on the map and compare the plot and its area.' },
  ownership: { label: 'Ownership chain', site: 'IGR registered deeds + Ferfar register', link: 'https://igrmaharashtra.gov.in/', hint: 'Check the registered deeds (Index II) and mutation entries match the holders, last mutation and tenure.' },
  portal: { label: 'Government portal check', site: 'Digital Satbara — Verify 7/12', link: 'https://digitalsatbara.mahabhumi.gov.in/dslr/', hint: 'Enter the 16-digit verification number on the portal; the record must match this document.' },
  charges: { label: 'Loans / mortgages (optional)', site: 'CERSAI public search', link: 'https://www.cersai.org.in/', hint: 'Search the property for any registered charge.' },
  court: { label: 'Court cases (optional)', site: 'eCourts party-name search', link: 'https://ecourts.gov.in/ecourts_home/', hint: 'Search each holder name; confirm any hit is the same person.' },
};

/** Which outside source confirms which field of the 7/12. */
export const FIELD_SOURCE = {
  district: 'map', taluka: 'map', village: 'map', villageCode: 'map', gat: 'map', area: 'map',
  tenure: 'ownership', holders: 'ownership', pending: 'ownership', lastMut: 'ownership',
  puid: 'portal', verifyNo: 'portal',
};
export const EXTRA_CHECKS = ['charges', 'court'];
export const FIELD_LABEL = {
  district: 'District', taluka: 'Taluka', village: 'Village', villageCode: 'Village code', gat: 'Gat / survey no.', area: 'Total area',
  tenure: 'Tenure', holders: 'Holders', pending: 'Pending mutation', lastMut: 'Last mutation', puid: 'PU-ID', verifyNo: 'Verification no.',
};

const haOf = (s) => { const m = String(s || '').match(/^(\d+)\.(\d{2})/); return m ? Number(m[1]) + Number(m[2]) / 100 : null; };
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const ascii = (s) => /^[\x20-\x7e]*$/.test(String(s || ''));

/** Checks against the village map we hold. available=false when we have no map for this village. */
export function autoMapChecks(vals) {
  const code = String(vals.villageCode || '').trim();
  const lib = code ? library()[code] : null;
  if (!lib) return { available: false, results: {} };
  const r = {};
  r.villageCode = { ok: true, note: `Village code ${code} is ${lib.village} on the map` };
  r.village = { ok: !ascii(vals.village) || norm(vals.village) === norm(lib.village), note: `Map says ${lib.village}` };
  const tal = enTaluka(vals.taluka) || vals.taluka; const dis = enDistrict(vals.district) || vals.district;
  r.taluka = { ok: norm(tal) === norm(lib.taluka), note: `Map says ${lib.taluka}` };
  r.district = { ok: norm(dis) === norm(lib.district), note: `Map says ${lib.district}` };
  const hit = findParcel(code, vals.gat);
  r.gat = hit ? { ok: true, note: `Plot ${vals.gat} exists on the map (${lib.source})` } : { ok: false, note: `Gat ${vals.gat || '—'} is not on the ${lib.village} map` };
  const ha = haOf(vals.area);
  if (hit && ha) {
    const diff = (Math.abs(hit.parcel.ha - ha) / ha) * 100;
    r.area = { ok: diff < 2, note: `7/12 ${ha.toFixed(2)} ha vs map ${hit.parcel.ha.toFixed(2)} ha (${diff.toFixed(1)}% apart)` };
  } else if (hit) r.area = { ok: false, note: 'Area on the 7/12 is missing or unreadable' };
  return { available: true, results: r };
}

/** The outside-source check an Admin does is recorded per field. manual = map of field -> saved check row. */
export function summarize({ sigOk, vals, manual }) {
  const auto = autoMapChecks(vals);
  const fields = {};
  Object.entries(FIELD_SOURCE).forEach(([f, src]) => {
    const a = src === 'map' && auto.available ? auto.results[f] : null;
    const m = manual[f];
    if (a) fields[f] = { state: a.ok ? 'verified' : 'mismatch', by: 'auto', source: SOURCES[src].site, note: a.note };
    else if (m) fields[f] = { state: m.result === 'match' ? 'verified' : 'mismatch', by: 'admin', source: SOURCES[src].site, note: m.note, evidence: m.evidence_path };
    else fields[f] = { state: 'pending', by: null, source: SOURCES[src].site, note: '' };
  });
  const all = Object.keys(FIELD_SOURCE);
  const verified = all.filter((f) => fields[f].state === 'verified').length;
  const mismatch = all.some((f) => fields[f].state === 'mismatch') || ['charges', 'court'].some((f) => manual[f]?.result === 'mismatch');
  const required = [
    { id: 'signature', label: 'Digital signature genuine and unaltered', done: !!sigOk },
    { id: 'fields', label: `Every field confirmed by an outside source (${verified} of ${all.length})`, done: verified === all.length },
  ];
  return { fields, required, mismatch, verified, fieldTotal: all.length, doneCount: required.filter((x) => x.done).length, total: required.length, authenticated: required.every((x) => x.done) && !mismatch, autoMap: auto.available };
}

export async function loadChecks(vid) {
  const { data } = await supabase.from('field_checks').select('field, source, result, note, evidence_path, created_at').eq('verification_id', vid);
  return Object.fromEntries((data || []).map((r) => [r.field, r]));
}

/**
 * Admin records the outcome of one outside check for one or more fields. Each field still gets its OWN record
 * (own result, source, note and receipt); the receipt file is uploaded once and shared by the fields it supports.
 * Returns an error message or null.
 */
export async function saveChecks(vid, fields, result, note, file) {
  let evidence_path = null;
  if (file) {
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5);
    evidence_path = `${vid}/${fields[0]}-${Date.now()}.${ext}`;
    const up = await supabase.storage.from('evidence').upload(evidence_path, file, { upsert: false });
    if (up.error) return 'Could not upload the receipt. Try a smaller file.';
  }
  const rows = fields.map((f) => ({ verification_id: vid, field: f, source: FIELD_SOURCE[f] || f, result, note: note.trim(), ...(evidence_path ? { evidence_path } : {}) }));
  const { error } = await supabase.from('field_checks').upsert(rows, { onConflict: 'verification_id,field' });
  return error ? 'Could not save. Add a note of at least 5 characters.' : null;
}

export async function evidenceUrl(path) {
  const { data } = await supabase.storage.from('evidence').createSignedUrl(path, 300);
  return data?.signedUrl || null;
}

/** Admin rejects a document. It stays on record and the same file can never be uploaded again. */
export async function rejectDocument(vid, reason) {
  const { data: v } = await supabase.from('verifications').select('sha256').eq('id', vid).maybeSingle();
  if (!v) return 'Could not find this document.';
  const { error } = await supabase.from('rejections').insert({ verification_id: vid, sha256: v.sha256, reason: reason.trim() });
  return error ? 'Could not record the rejection. Give a reason of at least 5 characters.' : null;
}
