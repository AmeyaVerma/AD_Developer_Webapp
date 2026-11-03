import { useCallback, useEffect, useState } from 'react';
import { getMou, mouFileName, mouUrl, removeMou, saveMou } from './mou';
import { SUPABASE_ON } from './supabase';
import { actions } from './store';

/** The signed MOU for a property. Admin attaches it; the property's own agent can read it. */
export default function MouSection({ p, admin }) {
  const [doc, setDoc] = useState(undefined); // undefined = loading, null = none
  const [url, setUrl] = useState(null);
  const [f, setF] = useState({ file: null, date: '', note: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const d = await getMou(p.id);
    setDoc(d); setUrl(d ? await mouUrl(d.file_path) : null);
  }, [p.id]);
  useEffect(() => { if (SUPABASE_ON) load(); }, [load]);

  if (!SUPABASE_ON) return <p className="dim">MOU documents need the server login to be connected.</p>;
  if (doc === undefined) return <p className="dim">Loading…</p>;

  const type = doc?.file_path.endsWith('.pdf') ? 'application/pdf' : doc?.file_path.endsWith('.png') ? 'image/png' : 'image/jpeg';
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    if (!f.file) { setErr('Choose the MOU file first.'); return; }
    setBusy(true);
    const e2 = await saveMou(p, f.file, f.date, f.note);
    setBusy(false);
    if (e2) { setErr(e2); return; }
    setF({ file: null, date: '', note: '' }); actions.touch(); actions.notify('MOU attached'); load();
  };
  const remove = async () => {
    if (!window.confirm('Remove this MOU document?')) return;
    const e2 = await removeMou(p);
    if (e2) { setErr(e2); return; }
    actions.touch(); actions.notify('MOU removed'); load();
  };

  return (
    <div className="mousec">
      {doc ? (
        <div className="moudoc">
          <p><span className="chip ok">✓ MOU on file</span>{doc.mou_date && <span className="dim"> · signed {new Date(doc.mou_date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>}</p>
          {doc.note && <p className="small dim">{doc.note}</p>}
          <div className="row wrap">
            {url && <a className="btn sm" href={url} target="_blank" rel="noopener noreferrer">Open MOU ↗</a>}
            {url && <a className="btn ghost sm" href={url} download={mouFileName(p, type)}>Download</a>}
            {admin && <button className="btn ghost sm danger" onClick={remove}>Remove</button>}
          </div>
          {url && type !== 'application/pdf' && <img src={url} alt="MOU document" style={{ maxWidth: '100%', marginTop: 12, border: '1px solid var(--line2)', borderRadius: 10 }} />}
          {url && type === 'application/pdf' && <iframe title="MOU document" src={url} style={{ width: '100%', height: 420, marginTop: 12, border: '1px solid var(--line2)', borderRadius: 10, background: '#fff' }} />}
        </div>
      ) : (
        <p className="dim">{p.mou ? 'The MOU is marked as completed, but no document is attached yet.' : 'No MOU document attached.'}</p>
      )}

      {admin && (
        <form onSubmit={submit} noValidate className="mouform">
          <h4>{doc ? 'Replace the MOU document' : 'Attach the MOU document'}</h4>
          <label>File (PDF, JPG or PNG, up to 8 MB)<input type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setF({ ...f, file: e.target.files[0] || null })} /></label>
          <label>MOU signed on<input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
          <label>Note (optional)<input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="e.g. token ₹5 lakh paid, sale deed within 90 days" /></label>
          {err && <p className="lg-err" role="alert">{err}</p>}
          <button className="btn" disabled={busy || !f.file}>{busy ? 'Uploading…' : doc ? 'Replace MOU' : 'Attach MOU'}</button>
        </form>
      )}
    </div>
  );
}
