import { useState } from 'react';
import GovCompare from './GovCompare';
import { rejectDocument } from './checks';
import { removeOriginal } from './originals';
import { removeProp, updateProp } from './data';
import { actions } from './store';

/** Admin's review of a property an agent submitted: run the checks, then Select (goes to video) or Reject (kept on record). */
export default function Review({ p }) {
  const [rj, setRj] = useState(null);
  const [err, setErr] = useState('');

  const select = async () => {
    try { await updateProp(p.id, { approval: 'approved' }); actions.touch(); actions.notify('Selected — property is now live'); location.hash = `#/video/${p.id}`; } catch (e) { setErr(String(e.message || e)); }
  };
  const reject = async () => {
    const e = await rejectDocument(p.verificationId, rj || '');
    if (e) { setErr(e); return; }
    try { await removeProp(p.id); removeOriginal(p.id); actions.touch(); actions.notify('Rejected and kept on record'); location.hash = '#/admin/props'; } catch (x) { setErr(String(x.message || x)); }
  };

  return (
    <section className="sec vreview">
      <h2>Review — submitted by Agent {p.agent}</h2>
      {p.record712?._edited?.length > 0 && <p className="lg-err">The agent edited these fields after reading the document: {p.record712._edited.join(', ')}. Check them against the original.</p>}
      <GovCompare vid={p.verificationId} admin p={{ taluka: p.taluka, village: p.village, gat: p.gat, district: p.district, villageCode: p.villageCode }} mr={{ district: p.record712?.district, taluka: p.record712?.taluka, village: p.record712?.villageMr || p.record712?.village }} />
      {err && <p className="lg-err" role="alert">{err}</p>}
      <div className="stack">
        <button className="btn" onClick={select}>Select</button>
        <button className="btn ghost danger" onClick={() => setRj('')}>Reject</button>
      </div>
      {rj !== null && (
        <div className="vreject">
          <label>Reason for rejecting (kept on record)<textarea rows="2" value={rj} onChange={(e) => setRj(e.target.value)} /></label>
          <div className="row"><button className="btn danger" disabled={rj.trim().length < 5} onClick={reject}>Confirm reject</button><button className="btn ghost" onClick={() => setRj(null)}>Cancel</button></div>
        </div>
      )}
    </section>
  );
}
