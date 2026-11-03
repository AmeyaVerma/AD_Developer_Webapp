import { useCallback, useEffect, useMemo, useState } from 'react';
import { EXTRA_CHECKS, FIELD_LABEL, FIELD_SOURCE, SOURCES, evidenceUrl, loadChecks, saveChecks, summarize } from './checks';
import { supabase } from './supabase';

const Tick = ({ s }) => <i className={`vtick ${s}`} aria-label={s}>{s === 'verified' ? '✓' : s === 'mismatch' ? '✖' : '○'}</i>;

/**
 * Every field of the 7/12 has its own tick, its own source and its own record. A tick means an outside source
 * (the cadastral map, or an official site checked by Admin) confirmed THAT field — the document's signature alone never does.
 */
export default function VerifyPanel({ vid, vals, admin, onState }) {
  const [ver, setVer] = useState(null);
  const [manual, setManual] = useState({});
  const [pick, setPick] = useState({}); // source -> { fields:Set, result, note, file }
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const [{ data }, checks] = await Promise.all([
      supabase.from('verifications').select('status, signer, signed_at, verification_no').eq('id', vid).maybeSingle(),
      loadChecks(vid),
    ]);
    setVer(data || null); setManual(checks);
  }, [vid]);
  useEffect(() => { load(); }, [load]);

  const sigOk = ver?.status === 'authentic' || ver?.status === 'admin_verified';
  const sum = useMemo(() => summarize({ sigOk, vals, manual }), [sigOk, vals, manual]);
  useEffect(() => { onState?.({ authenticated: sum.authenticated, mismatch: sum.mismatch, done: sum.verified, total: sum.fieldTotal }); }, [sum.authenticated, sum.mismatch, sum.verified, sum.fieldTotal]); // eslint-disable-line react-hooks/exhaustive-deps

  const P = (s) => pick[s] || { fields: [], result: '', note: '', file: null };
  const setP = (s, patch) => setPick({ ...pick, [s]: { ...P(s), ...patch } });
  const toggle = (s, f) => { const cur = P(s).fields; setP(s, { fields: cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f] }); };

  const save = async (s) => {
    const p = P(s);
    if (!p.fields.length) { setErr('Tick the fields this check covers.'); return; }
    if (!p.result) { setErr('Choose Matches or Does not match.'); return; }
    setBusy(s); setErr('');
    const e = await saveChecks(vid, p.fields, p.result, p.note, p.file);
    setBusy('');
    if (e) { setErr(e); return; }
    setPick({ ...pick, [s]: undefined }); load();
  };
  const openEvidence = async (path) => { const u = await evidenceUrl(path); if (u) window.open(u, '_blank', 'noopener'); };

  // fields still needing an Admin check, grouped by the outside source that can confirm them
  const groups = {};
  Object.entries(FIELD_SOURCE).forEach(([f, s]) => {
    if (sum.fields[f].by === 'auto') return;
    (groups[s] = groups[s] || []).push(f);
  });

  return (
    <div className="vpanel">
      {sum.authenticated
        ? <div className="vauth" role="status"><b>✓ Authenticated Document</b><span>Genuine signature, and all {sum.fieldTotal} fields confirmed by outside sources.</span></div>
        : <div className="vwait" role="status"><b>Verification in progress</b><span>{sum.verified} of {sum.fieldTotal} fields confirmed{sigOk ? '' : ' — the document itself is not authenticated'}{sum.mismatch ? ' — a field does not match' : ''}</span></div>}
      {ver && <p className="small dim">{ver.status === 'authentic' ? `Digital signature: valid, signed by ${ver.signer?.CN || '—'}${ver.signed_at ? ` on ${new Date(ver.signed_at).toLocaleDateString()}` : ''}.` : ver.status === 'admin_verified' ? `Accepted by Admin after checking number ${ver.verification_no} on the portal (no digital signature).` : 'This document is not authenticated.'}</p>}

      <h4>Fields</h4>
      <div className="vfields">
        {Object.keys(FIELD_SOURCE).map((f) => {
          const x = sum.fields[f];
          const v = String(vals[f] ?? '').replace(/\s+/g, ' ').trim();
          return (
            <div key={f} className={`vf ${x.state}`} title={x.note}>
              <Tick s={x.state} />
              <div>
                <small>{FIELD_LABEL[f]}</small><b>{v || '—'}</b>
                <em>{x.state === 'pending' ? `Not yet confirmed — ${x.source}` : `${x.state === 'verified' ? 'Confirmed' : 'Does not match'} by ${x.source}${x.by === 'auto' ? ' (automatic)' : ' (Admin)'}`}</em>
                {x.note && <em className="vnote">{x.note}{x.evidence && <> · <button type="button" className="linkbtn" onClick={() => openEvidence(x.evidence)}>receipt</button></>}</em>}
              </div>
            </div>
          );
        })}
      </div>

      {admin && (
        <>
          <h4>Confirm fields with outside sources</h4>
          <p className="small dim">Open the site, compare, then tick the fields that check covers. Each field is saved with its own result and note.</p>
          {err && <p className="lg-err" role="alert">{err}</p>}
          {Object.entries(groups).map(([s, fs]) => {
            const S = SOURCES[s]; const p = P(s);
            return (
              <div key={s} className="vsrc">
                <div className="row between"><b>{S.label}</b><a href={S.link} target="_blank" rel="noopener noreferrer">{S.site} ↗</a></div>
                <p className="small dim">{S.hint}</p>
                <div className="vchips">
                  {fs.map((f) => <label key={f} className={`vchip ${sum.fields[f].state}`}><input type="checkbox" checked={p.fields.includes(f)} onChange={() => toggle(s, f)} /> {FIELD_LABEL[f]}{sum.fields[f].state !== 'pending' ? (sum.fields[f].state === 'verified' ? ' ✓' : ' ✖') : ''}</label>)}
                </div>
                <div className="vform">
                  <select value={p.result} onChange={(e) => setP(s, { result: e.target.value })}><option value="">Result…</option><option value="match">Matches this document</option><option value="mismatch">Does not match</option></select>
                  <input value={p.note} onChange={(e) => setP(s, { note: e.target.value })} placeholder="What you checked (reference no., date)" />
                  <input type="file" accept="image/*,application/pdf" onChange={(e) => setP(s, { file: e.target.files[0] })} aria-label="Receipt or screenshot (optional)" />
                  <button type="button" className="btn sm" disabled={busy === s || !p.fields.length || !p.result || p.note.trim().length < 5} onClick={() => save(s)}>{busy === s ? 'Saving…' : `Save for ${p.fields.length || 'selected'} field${p.fields.length === 1 ? '' : 's'}`}</button>
                </div>
              </div>
            );
          })}
          <h4>Optional extra checks</h4>
          {EXTRA_CHECKS.map((x) => {
            const S = SOURCES[x]; const d = manual[x]; const p = P(x);
            return (
              <div key={x} className="vsrc">
                <div className="row between"><b>{S.label}</b><a href={S.link} target="_blank" rel="noopener noreferrer">{S.site} ↗</a></div>
                <p className="small dim">{S.hint}</p>
                {d && <p className={`vdone ${d.result}`}>{d.result === 'match' ? '✓ Clear' : '✖ Found something'} — {d.note}</p>}
                <div className="vform">
                  <select value={p.result} onChange={(e) => setPick({ ...pick, [x]: { ...p, fields: [x], result: e.target.value } })}><option value="">Result…</option><option value="match">Nothing found / clear</option><option value="mismatch">Found something</option></select>
                  <input value={p.note} onChange={(e) => setPick({ ...pick, [x]: { ...p, fields: [x], note: e.target.value } })} placeholder="What you searched (names, dates)" />
                  <input type="file" accept="image/*,application/pdf" onChange={(e) => setPick({ ...pick, [x]: { ...p, fields: [x], file: e.target.files[0] } })} aria-label="Receipt or screenshot (optional)" />
                  <button type="button" className="btn sm" disabled={busy === x || !p.result || p.note.trim().length < 5} onClick={() => save(x)}>{busy === x ? 'Saving…' : 'Save'}</button>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
