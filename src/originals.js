// The original uploaded 7/12 for each property. Files are kept in IndexedDB (too big for localStorage);
// the seeded client property (Gat 88) uses the sample PDF that ships with the app.
import { SUPABASE_ON, supabase } from './supabase';

const DB = 'ab_originals_v1';
const STORE = 'files';

const open = () => new Promise((res, rej) => {
  const rq = indexedDB.open(DB, 1);
  rq.onupgradeneeded = () => rq.result.createObjectStore(STORE);
  rq.onsuccess = () => res(rq.result);
  rq.onerror = () => rej(rq.error);
});
const tx = async (mode, fn) => {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    t.oncomplete = () => res(r.result);
    t.onerror = () => rej(t.error);
  });
};

export const saveOriginal = (id, file) => tx('readwrite', (s) => s.put(file, String(id)));
export const removeOriginal = (id) => tx('readwrite', (s) => s.delete(String(id))).catch(() => {});

/** Resolves to { url, type } for the property's original 7/12, or null if none was uploaded. */
export async function loadOriginal(p) {
  if (SUPABASE_ON && p.verificationId) {
    const { data: v } = await supabase.from('verifications').select('file_path').eq('id', p.verificationId).maybeSingle();
    const path = v?.file_path || `${p.verificationId}.pdf`;
    const { data } = await supabase.storage.from('originals').createSignedUrl(path, 600);
    const type = path.endsWith('.png') ? 'image/png' : path.endsWith('.webp') ? 'image/webp' : path.endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : /\.jpe?g$/.test(path) ? 'image/jpeg' : 'application/pdf';
    return data?.signedUrl ? { url: data.signedUrl, type } : null;
  }
  if (p.real) return { url: `${import.meta.env.BASE_URL}sample/nanoshi_88_satbara.pdf`, type: 'application/pdf' };
  try {
    const f = await tx('readonly', (s) => s.get(String(p.id)));
    return f ? { url: URL.createObjectURL(f), type: f.type || 'application/pdf' } : null;
  } catch (e) { return null; }
}
