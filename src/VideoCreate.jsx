import { useState } from 'react';
import { areaOf, availableOf, propById, propFileName } from './data';
import { canSee, useAuth } from './auth';
import { Thumb } from './ui';

const OPTS = {
  length: [['15', '15 seconds'], ['30', '30 seconds'], ['60', '60 seconds']],
  style: [['sat', 'Satellite flyover'], ['3d', '3D terrain orbit'], ['both', 'Satellite, then 3D']],
  lang: [['en', 'English'], ['mr', 'Marathi']],
  voice: [['none', 'No voice-over'], ['f', 'Female voice'], ['m', 'Male voice']],
  music: [['none', 'No music'], ['calm', 'Calm'], ['upbeat', 'Upbeat']],
};

/** Video generation screen — layout only for now; generating a video is not connected yet. */
export default function VideoCreate({ id }) {
  const me = useAuth();
  const p = propById(id);
  const [o, setO] = useState({ length: '30', style: 'both', lang: 'en', voice: 'none', music: 'calm', showArea: true, showGat: true, showAuthority: false });
  if (!p || !canSee(p, me.id)) return <div className="page"><p>Not found · <a href="#/admin/props">← All properties</a></p></div>;

  const name = [p.taluka, p.village].filter(Boolean).join(' - ');
  const area = areaOf(p); const avail = availableOf(p);
  const Pick = ({ k, label }) => (
    <label className="vcf">{label}
      <select value={o[k]} onChange={(e) => setO({ ...o, [k]: e.target.value })}>{OPTS[k].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
    </label>
  );

  return (
    <div className="page vcreate">
      <a className="back" href={`#/property/${p.id}`}>← Back to property</a>
      <div className="pagehead"><div className="title"><h1>Create site video</h1></div></div>
      <div className="vcgrid">
        <section className="setcard">
          <h3>Property</h3>
          <div className="vsum">
            <Thumb parcel={p.parcel} w={320} h={200} />
            <dl className="ledger">
              <div className="trow"><dt>Location</dt><dd>{name}</dd></div>
              <div className="trow"><dt>Gat / Survey No.</dt><dd>{p.gat}</dd></div>
              <div className="trow"><dt>Total area</dt><dd>{area != null ? `${area.toFixed(2)} ha` : '—'}</dd></div>
              <div className="trow"><dt>Available area</dt><dd>{avail != null ? `${avail.toFixed(2)} ha` : '—'}</dd></div>
              <div className="trow"><dt>Planning authority</dt><dd>{p.planningAuthority || '—'}</dd></div>
              <div className="trow"><dt>District</dt><dd>{p.district || '—'}</dd></div>
            </dl>
          </div>
          <p className="small dim">These details come from the selected property.</p>
        </section>

        <section className="setcard">
          <h3>Style and length</h3>
          <div className="vcopts">
            <Pick k="length" label="Length" /><Pick k="style" label="Style" /><Pick k="lang" label="Language" /><Pick k="voice" label="Voice-over" /><Pick k="music" label="Music" />
          </div>
          <h4>Show on screen</h4>
          {[['showGat', 'Gat / Survey No.'], ['showArea', 'Area'], ['showAuthority', 'Planning authority']].map(([k, l]) => (
            <label key={k} className="inl"><input type="checkbox" checked={o[k]} onChange={(e) => setO({ ...o, [k]: e.target.checked })} /> {l}</label>
          ))}
        </section>

        <section className="setcard vwide">
          <h3>Preview and output</h3>
          <div className="vprev" aria-label="Video preview">
            <Thumb parcel={p.parcel} w={640} h={360} />
            <div className="vcap"><b>{name}</b>{o.showGat && <span>Gat {p.gat}</span>}{o.showArea && area != null && <span>{area.toFixed(2)} ha</span>}{o.showAuthority && p.planningAuthority && <span>{p.planningAuthority}</span>}</div>
            <span className="vsoon">Preview — video generation coming soon</span>
          </div>
          <div className="vout">
            <div><small>File name</small><b>{propFileName(p, 'mp4')}</b></div>
            <div className="row">
              <button className="btn" disabled title="Not connected yet">Generate video</button>
              <button className="btn ghost" disabled>Download</button>
              <button className="btn ghost" disabled>Share on WhatsApp</button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
