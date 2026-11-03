import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { propFileName } from './data';
import { loadOriginal } from './originals';
import { useT } from './i18n';

/** The original 7/12 as uploaded for a property — shown as-is, never re-typed or regenerated. */
export default function Original712({ p, height = 640 }) {
  const { t } = useT();
  const [doc, setDoc] = useState(undefined); // undefined = loading, null = none on file
  const [ver, setVer] = useState(null);
  useEffect(() => {
    setVer(null);
    if (!supabase || !p.verificationId) return;
    supabase.from('verifications').select('status, signer, signed_at, verification_no, override_note').eq('id', p.verificationId).maybeSingle().then(({ data }) => setVer(data || null));
  }, [p.verificationId]);
  useEffect(() => {
    let live = true; let made = null;
    setDoc(undefined);
    loadOriginal(p).then((d) => { if (!live) return; made = d; setDoc(d); });
    return () => { live = false; if (made && made.url.startsWith('blob:')) URL.revokeObjectURL(made.url); };
  }, [p.id]);

  if (doc === undefined) return <p className="dim">{t('Loading…')}</p>;
  if (!doc) {
    return (
      <div className="card-empty">
        <b>{t('The original 7/12 is not on file for this property.')}</b>
        <p className="dim small">{t('Add the property by uploading its 7/12, and the original will be kept here.')}</p>
      </div>
    );
  }
  const ext = /pdf/.test(doc.type) ? 'pdf' : (doc.type.split('/')[1] || 'jpg');
  const isImg = doc.type.startsWith('image/');
  return (
    <div className="orig712">
      {ver?.status === 'authentic' && <p className="vbadge">✓ {t('Authenticated')} — {t('digitally signed by')} {ver.signer?.CN || '—'}{ver.signed_at ? ` · ${new Date(ver.signed_at).toLocaleDateString()}` : ''}</p>}
      {ver?.status === 'admin_verified' && <p className="vbadge">✓ {t('Verified by Admin on the government portal')} · {t('no.')} {ver.verification_no}</p>}
      <div className="row wrap" style={{ marginBottom: 10 }}>
        <a className="btn sm" href={doc.url} target="_blank" rel="noopener noreferrer">{t('Open original 7/12')} ↗</a>
        <a className="btn ghost sm" href={doc.url} download={propFileName(p, ext)}>{t('Download')}</a>
      </div>
      {isImg
        ? <img src={doc.url} alt={t('Original 7/12')} style={{ maxWidth: '100%', border: '1px solid var(--line2)', borderRadius: 10 }} />
        : <iframe title={t('Original 7/12')} src={doc.url} style={{ width: '100%', height, border: '1px solid var(--line2)', borderRadius: 10, background: '#fff' }} />}
    </div>
  );
}
