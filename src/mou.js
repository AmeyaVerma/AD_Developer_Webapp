// MOU (Memorandum of Understanding) documents. The database is the truth: a property counts as "MOU done"
// when it has an MOU document on file (plus the demo flags built into the sample properties).
import { PROPS, propFileName } from './data';
import { SUPABASE_ON, supabase } from './supabase';

export const MOU_MAX = 8 * 1024 * 1024;
export const MOU_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

const apply = (rows) => {
  const byId = Object.fromEntries(rows.map((r) => [r.property_id, r]));
  PROPS.forEach((p) => {
    const r = byId[p.id];
    if (r) { p.mou = true; p.mouDate = r.mou_date || p.mouDate || ''; p.mouDoc = true; } else p.mouDoc = false;
  });
};

/** Mark every property that has an MOU document. Call after the properties are loaded. */
export async function hydrateMou() {
  if (!SUPABASE_ON) return;
  const { data } = await supabase.from('mou_documents').select('property_id, mou_date');
  apply(data || []);
}

export async function getMou(propId) {
  const { data } = await supabase.from('mou_documents').select('property_id, file_path, file_name, mou_date, note, created_at').eq('property_id', propId).maybeSingle();
  return data || null;
}

export async function mouUrl(path) {
  const { data } = await supabase.storage.from('mou').createSignedUrl(path, 600);
  return data?.signedUrl || null;
}

/** Admin attaches (or replaces) the MOU for a property. Returns an error message or null. */
export async function saveMou(p, file, date, note) {
  if (!MOU_TYPES.includes(file.type)) return 'Upload a PDF, JPG or PNG.';
  if (file.size > MOU_MAX) return 'The file is larger than 8 MB.';
  const old = await getMou(p.id);
  const ext = file.type === 'application/pdf' ? 'pdf' : file.type === 'image/png' ? 'png' : 'jpg';
  const path = `${p.id}/${Date.now()}.${ext}`;
  const up = await supabase.storage.from('mou').upload(path, file, { contentType: file.type, upsert: false });
  if (up.error) return 'Could not upload the file. Try again.';
  const { error } = await supabase.from('mou_documents').upsert({ property_id: p.id, file_path: path, file_name: file.name, mou_date: date || null, note: (note || '').trim() || null }, { onConflict: 'property_id' });
  if (error) { await supabase.storage.from('mou').remove([path]); return 'Could not save the MOU. Try again.'; }
  if (old?.file_path) await supabase.storage.from('mou').remove([old.file_path]); // the replaced file
  p.mou = true; p.mouDate = date || p.mouDate || ''; p.mouDoc = true;
  return null;
}

export async function removeMou(p) {
  const old = await getMou(p.id);
  if (!old) return null;
  const { error } = await supabase.from('mou_documents').delete().eq('property_id', p.id);
  if (error) return 'Could not remove the MOU.';
  await supabase.storage.from('mou').remove([old.file_path]);
  p.mouDoc = false;
  if (!p.mouSeed) { p.mou = false; p.mouDate = ''; }
  return null;
}

export const mouFileName = (p, type) => propFileName(p, type === 'application/pdf' ? 'pdf' : type === 'image/png' ? 'png' : 'jpg').replace(/\.(\w+)$/, '_MOU.$1');
