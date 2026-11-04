// The government's own copy of a satbara (from Mahabhulekh), kept next to the document the user uploaded.
// It is attached by staff because Mahabhulekh only shows a record after a mobile number and a captcha.
import { PDFDocument } from 'pdf-lib';
import { supabase } from './supabase';

export const GOV_MAX = 8 * 1024 * 1024;
export const GOV_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

export async function getGov(vid) {
  const { data } = await supabase.from('govt_originals').select('verification_id, file_path, file_name, note, created_at').eq('verification_id', vid).maybeSingle();
  return data || null;
}
export async function govUrl(path) {
  const { data } = await supabase.storage.from('govt-originals').createSignedUrl(path, 600);
  return data?.signedUrl || null;
}
export const govType = (path) => (path.endsWith('.png') ? 'image/png' : path.endsWith('.webp') ? 'image/webp' : /\.jpe?g$/.test(path) ? 'image/jpeg' : 'application/pdf');

/** Admin attaches (or replaces) the original. Returns an error message or null. */
export async function saveGov(vid, file, note) {
  if (!GOV_TYPES.includes(file.type)) return 'Attach a PDF, JPG, PNG or WebP file.';
  if (file.size > GOV_MAX) return 'The file is larger than 8 MB.';
  const old = await getGov(vid);
  const ext = file.type === 'application/pdf' ? 'pdf' : file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${vid}/${Date.now()}.${ext}`;
  const up = await supabase.storage.from('govt-originals').upload(path, file, { contentType: file.type, upsert: false });
  if (up.error) return 'Could not upload the file. Try again.';
  const { error } = await supabase.from('govt_originals').upsert({ verification_id: vid, file_path: path, file_name: file.name, note: (note || '').trim() || null }, { onConflict: 'verification_id' });
  if (error) { await supabase.storage.from('govt-originals').remove([path]); return 'Could not save the original. Try again.'; }
  if (old?.file_path) await supabase.storage.from('govt-originals').remove([old.file_path]);
  return null;
}
export async function removeGov(vid) {
  const old = await getGov(vid);
  if (!old) return null;
  const { error } = await supabase.from('govt_originals').delete().eq('verification_id', vid);
  if (error) return 'Could not remove the original.';
  await supabase.storage.from('govt-originals').remove([old.file_path]);
  return null;
}

/** Turn a stored original into a PDF Blob (a PDF is passed through; a picture is placed on an A4 page). */
export async function asPdfBlob(url, type) {
  const bytes = await (await fetch(url)).arrayBuffer();
  if (type === 'application/pdf') return new Blob([bytes], { type: 'application/pdf' });
  let png = bytes; let isPng = type === 'image/png'; let jpg = type === 'image/jpeg' ? bytes : null;
  if (!isPng && !jpg) { // WebP: draw it on a canvas and re-encode as PNG
    const bmp = await createImageBitmap(new Blob([bytes], { type }));
    const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height; c.getContext('2d').drawImage(bmp, 0, 0);
    png = await (await new Promise((res) => c.toBlob(res, 'image/png'))).arrayBuffer(); isPng = true;
  }
  const doc = await PDFDocument.create();
  const img = isPng ? await doc.embedPng(png) : await doc.embedJpg(jpg);
  const W = 595, H = 842, k = Math.min((W - 40) / img.width, (H - 40) / img.height);
  const page = doc.addPage([W, H]);
  page.drawImage(img, { x: (W - img.width * k) / 2, y: (H - img.height * k) / 2, width: img.width * k, height: img.height * k });
  return new Blob([await doc.save()], { type: 'application/pdf' });
}
