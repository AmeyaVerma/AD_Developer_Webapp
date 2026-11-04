import { useCallback, useEffect, useState } from 'react';
import Original712 from './Original712';
import { asPdfBlob, getGov, govType, govUrl, removeGov, saveGov } from './govOriginal';
import { propFileName } from './data';
import { actions } from './store';
import { useAuth } from './auth';
import { openMahabhulekh } from './fetchOriginal';

const SITE = 'https://bhulekh.mahabhumi.gov.in/';

const Copy = ({ label, value }) => {
  const [done, setDone] = useState(false);
  if (!value) return <div className="cmpkv"><small>{label}</small><b className="dim">—</b></div>;
  return (
    <div className="cmpkv">
      <small>{label}</small><b>{value}</b>
      <button type="button" className="linkbtn" onClick={async () => { try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); } catch (e) { /* ignore */ } }}>{done ? 'copied' : 'copy'}</button>
    </div>
  );
};

/**
 * Two sides: ORIGINAL SATBARA DOC (the government's own record, from Mahabhulekh) and
 * UPLOADED SATBARA DOCUMENT (what the user uploaded). Mahabhulekh asks for a mobile number and a captcha, so a person
 * has to open it; this panel gives them the village / taluka / Gat to pick, then keeps the original they bring back.
 * @param vid   the uploaded document's record id
 * @param p     { taluka, village, gat, district, villageCode, villageMr } — also used to name the downloaded PDF
 */
export default function GovCompare({ vid, p, admin, mr = {} }) {
  const me = useAuth();
  const [gov, setGov] = useState(undefined);
  const [url, setUrl] = useState(null);
  const [f, setF] = useState({ file: null, note: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const g = await getGov(vid);
    setGov(g); setUrl(g ? await govUrl(g.file_path) : null);
  }, [vid]);
  useEffect(() => { load(); }, [load]);

  const submit = async (e) => {
    e.preventDefault(); setErr('');
    if (!f.file) { setErr('Choose the file first.'); return; }
    setBusy(true);
    const m = await saveGov(vid, f.file, f.note);
    setBusy(false);
    if (m) { setErr(m); return; }
    setF({ file: null, note: '' }); actions.notify('Original attached'); load();
  };
  const remove = async () => { if (!window.confirm('Remove the original?')) return; const m = await removeGov(vid); if (m) setErr(m); else { actions.notify('Original removed'); load(); } };
  const download = async () => {
    try {
      const blob = await asPdfBlob(url, govType(gov.file_path));
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = propFileName(p, 'pdf'); a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch (e) { setErr('Could not prepare the PDF.'); }
  };

  const type = gov ? govType(gov.file_path) : '';
  const uploaded = { ...p, id: vid, verificationId: vid };

  return (
    <div className="cmp">
      <section className="cmpcol">
        <h3>ORIGINAL SATBARA DOC</h3>
        {gov === undefined && <p className="dim">Loading…</p>}
        {gov && (
          <>
            <p className="small dim">The government's own record{gov.note ? ` — ${gov.note}` : ''}.</p>
            <div className="row wrap" style={{ marginBottom: 10 }}>
              <button type="button" className="btn sm" onClick={download} disabled={!url}>Download PDF</button>
              {url && <a className="btn ghost sm" href={url} target="_blank" rel="noopener noreferrer">Open ↗</a>}
              {admin && <button type="button" className="btn ghost sm danger" onClick={remove}>Remove</button>}
            </div>
            {url && type === 'application/pdf' && <iframe title="Original satbara" src={url} style={{ width: '100%', height: 460, border: '1px solid var(--line2)', borderRadius: 10, background: '#fff' }} />}
            {url && type !== 'application/pdf' && <img src={url} alt="Original satbara" style={{ maxWidth: '100%', border: '1px solid var(--line2)', borderRadius: 10 }} />}
          </>
        )}
        {gov === null && (
          <div className="cmpempty">
            <p><b>Not attached yet.</b> Mahabhulekh shows a record only after a mobile number and a captcha, so it can't be pulled automatically. Open it, choose these values, and bring the 7/12 back here.</p>
            <div className="cmpvals">
              <Copy label="District" value={p.district} />
              <Copy label="Taluka" value={p.taluka} />
              <Copy label="Village" value={p.village} />
              <Copy label="Gat / Survey No." value={p.gat} />
            </div>
            <ol className="small">
              <li>Open Mahabhulekh and choose <b>7/12</b>.</li>
              <li>Pick the district, taluka, village and Gat shown above.</li>
              <li>Enter a mobile number and the captcha, then Submit.</li>
              <li>Save the page as a PDF (or take a screenshot) and attach it below.</li>
            </ol>
            <div className="row wrap">
              <button type="button" className="btn sm" onClick={() => openMahabhulekh({ mr, gat: p.gat, phone: me.phone })}>Fetch original (auto-fill) ↗</button>
              <a className="btn ghost sm" href={SITE} target="_blank" rel="noopener noreferrer">Open Mahabhulekh plain ↗</a>
            </div>
            <p className="small dim">Auto-fill needs the helper extension on a laptop. {me.phone ? 'Your saved mobile number is filled in too.' : 'You have no mobile number saved — ask the Admin to add it in Settings.'} You only type the captcha.</p>
          </div>
        )}
        {gov !== undefined && admin && (
          <form onSubmit={submit} noValidate className="cmpform">
            <label>{gov ? 'Replace the original' : 'Attach the original'} (PDF, JPG, PNG or WebP)<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => setF({ ...f, file: e.target.files[0] || null })} /></label>
            <label>Note (optional)<input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="e.g. fetched 4 Nov from Mahabhulekh" /></label>
            {err && <p className="lg-err" role="alert">{err}</p>}
            <button className="btn" disabled={busy || !f.file}>{busy ? 'Uploading…' : gov ? 'Replace' : 'Attach original'}</button>
          </form>
        )}
        {gov !== undefined && !admin && gov === null && <p className="small dim">The Admin will attach the original.</p>}
      </section>

      <section className="cmpcol">
        <h3>UPLOADED SATBARA DOCUMENT</h3>
        <p className="small dim">The file that was uploaded.</p>
        <Original712 p={uploaded} height={460} />
      </section>
    </div>
  );
}
