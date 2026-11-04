import { useRef, useState } from 'react';
import { toCanvases } from './pipeline/pdf';
import { ocrCanvases } from './pipeline/ocr';
import { enDistrict, enTaluka, mrDistrict, mrTaluka, parse712 } from './pipeline/parse712';
import { findParcel, geocodeVillage, library, parseKml } from './pipeline/library';
import { buildKmz, download } from './pipeline/kmz';
import { recordFlyover } from './pipeline/flyover';
import SiteMap from './SiteMap';
import { FEATURES } from './features';
import { propFileName, saveNewProperty } from './data';
import { verifyFile } from './verify';
import { readDocument } from './pipeline/read';
import { loadLgd, lgdVillage } from './pipeline/lgd';
import GovCompare from './GovCompare';
import { rejectDocument } from './checks';
import { saveOriginal } from './originals';
import { actions } from './store';
import { AGENTS, DEMO_MODE, useAuth } from './auth';
import { AUTHORITIES, STATUSES, TYPES, makeProperty, toHectares, validateForm } from './properties';

const STEPS = ['Upload 7/12', 'Check details', 'Map & KMZ', 'Site video'];
const FIELDS = [
  ['district', 'District', 'जिल्हा'], ['taluka', 'Taluka', 'तालुका'], ['village', 'Village', 'गाव'], ['villageCode', 'Village code', '6 digits, in brackets after the village'],
  ['gat', 'Gat / survey no.', 'गट क्रमांक'], ['puid', 'PU-ID', '11 digits'], ['tenure', 'Tenure', 'भूधारणा पद्धती'], ['localName', 'Local field name', 'शेताचे स्थानीक नाव'],
  ['area', 'Total area (H.R.Sq.m)', 'एकूण क्षेत्र — type it, e.g. 2.33.00'], ['pending', 'Pending mutation', 'प्रलंबित फेरफार'], ['lastMut', 'Last mutation', 'शेवटचा फेरफार'], ['verifyNo', 'Verification no.', '16 digits at the bottom'],
];

const haOf = (s) => { const m = String(s).match(/^(\d+)\.(\d{2})/); return m ? Number(m[1]) + Number(m[2]) / 100 : null; };

export default function Wizard({ mode: variant = 'new' }) {
  const add = variant === 'add';
  const secure = add && !DEMO_MODE; // adding a property to the register requires an authenticated 7/12
  const MAPSTEP = secure ? 4 : 3;
  const steps = add ? (secure ? ['Upload 7/12', 'Check details', 'Verify', 'Location & save'] : ['Upload 7/12', 'Check details', 'Location & save']) : (FEATURES.videoCreation ? STEPS : STEPS.slice(0, 3));
  const [extra, setExtra] = useState({ type: TYPES[0], status: STATUSES[0], planningAuthority: AUTHORITIES[0], mou: false, soldHa: '', agent: '', price: '' });
  const [saveErr, setSaveErr] = useState({});
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState(null);
  const [vals, setVals] = useState({});
  const [showRaw, setShowRaw] = useState(false);
  const [geo, setGeo] = useState(null);
  const [mode, setMode] = useState('sat');
  const mapRef = useRef(null);
  const [vid, setVid] = useState(null);
  const [vp, setVp] = useState({ msg: '', t: 0, on: false });
  const [secs, setSecs] = useState(12);

  const me = useAuth();
  const fileRef = useRef(null);
  const ocrRef = useRef({});
  const [vr, setVr] = useState(null); // server's verdict on the uploaded 7/12
  const [rj, setRj] = useState(null); // reject reason box (null = closed)

  const read = async (file) => {
    fileRef.current = file;
    setErr(''); setParsed(null); setGeo(null); setVid(null); setFileName(file.name); setVr(null); setRj(null);
    if (secure) {
      setBusy('Uploading the 7/12…');
      const res = await verifyFile(file);
      setBusy('');
      setVr(res);
      if (!res.canProceed) return; // refused: rejected before, duplicate, or not a PDF/JPG/PNG
    }
    await readText(file);
  };
  const readText = async (file) => {
    try {
      setBusy('Opening file…');
      const p = await readDocument(file, setBusy);
      await loadLgd();
      setParsed(p);
      const v = {};
      Object.entries(p.fields).forEach(([k, f]) => { v[k] = f.value; });
      // The village code on the 7/12 identifies the village even when OCR garbles its name: take the official name.
      const official = lgdVillage(v.villageCode);
      const known = library()[v.villageCode];
      if (official) { v.villageMr = v.village; v.village = official[0]; p.fields.village = { value: official[0], status: 'ok' }; } else if (known && !v.village) v.village = known.village;
      // The village code is read reliably (several readings agree), and it decides the taluka and district in the official
      // list. So when the code is sure, the official taluka and district win over whatever the reader guessed from blurry text.
      if (official && p.fields.villageCode.status === 'ok') {
        const tMr = mrTaluka(official[1]); const dMr = mrDistrict(official[2]);
        if (tMr) { v.taluka = tMr; p.fields.taluka = { value: tMr, status: 'ok' }; }
        if (dMr) { v.district = dMr; p.fields.district = { value: dMr, status: 'ok' }; }
      }
      ocrRef.current = { ...v };
      setVals(v);
      setStep(2);
    } catch (e) { setErr(String(e.message || e)); } finally { setBusy(''); }
  };
  const sample = async () => {
    const r = await fetch('./sample/nanoshi_88_satbara.pdf');
    read(new File([await r.blob()], 'nanoshi_88_satbara.pdf', { type: 'application/pdf' }));
  };

  const locate = async () => {
    setErr(''); setBusy('Finding the plot…'); setVid(null);
    try {
      const lib = library()[vals.villageCode];
      const hit = findParcel(vals.villageCode, vals.gat);
      if (hit) setGeo({ exact: true, center: hit.parcel.c, rings: hit.parcel.p, ha: hit.parcel.ha, village: hit.village });
      else if (lib) {
        const cs = lib.parcels.map((p) => p.c);
        setGeo({ exact: false, center: [cs.reduce((s, c) => s + c[0], 0) / cs.length, cs.reduce((s, c) => s + c[1], 0) / cs.length], village: lib, missingGat: true });
      } else {
        const dEn = enDistrict(vals.district), tEn = enTaluka(vals.taluka);
        const g = await geocodeVillage([`${vals.village} ${vals.taluka} ${vals.district} Maharashtra India`, `${vals.village} ${tEn} ${dEn} Maharashtra`, `${vals.taluka} ${vals.district} Maharashtra`]);
        if (!g) throw new Error('Could not find this village on the map. Check the village, taluka and district, or add the village KML.');
        setGeo({ exact: false, center: g.center, label: g.label });
      }
      setStep(add ? MAPSTEP : 3);
    } catch (e) { setErr(String(e.message || e)); } finally { setBusy(''); }
  };

  const addKml = async (file) => {
    try { parseKml(await file.text(), file.name); await locate(); } catch (e) { setErr(String(e.message || e)); }
  };

  const names = () => {
    const v = geo?.village?.village || vals.village || 'Village';
    return { v, title: `Gat ${vals.gat} · ${v}`, sub: [enTaluka(vals.taluka) || vals.taluka, enDistrict(vals.district) || vals.district, 'Maharashtra'].filter(Boolean).join(', ') };
  };
  const details = () => ({
    Village: names().v, Taluka: enTaluka(vals.taluka) || vals.taluka, District: enDistrict(vals.district) || vals.district, 'Gat no.': vals.gat, 'PU-ID': vals.puid, Tenure: vals.tenure, 'Local name': vals.localName,
    Holders: (vals.holders || '').split('\n').filter(Boolean).join(', '), 'Area per 7/12 (H.R.Sq.m)': vals.area, 'Plot area on map (ha)': geo?.ha ? geo.ha.toFixed(2) : '', 'Pending mutation': vals.pending, 'Last mutation': vals.lastMut, 'Verification no.': vals.verifyNo,
  });
  const exportKmz = async () => {
    const blob = await buildKmz({ title: names().title, center: geo.center, rings: geo.exact ? geo.rings : null, details: details(), exact: geo.exact });
    download(blob, propFileName({ taluka: enTaluka(vals.taluka) || vals.taluka, village: names().v, gat: vals.gat }, 'kmz'));
  };

  const makeVideo = async () => {
    setErr(''); setVid(null); setVp({ msg: 'Starting…', t: 0, on: true });
    try {
      setMode('3d');
      await new Promise((r) => setTimeout(r, 1800));
      const blob = await recordFlyover(mapRef.current, { title: names().title, subtitle: names().sub, seconds: secs, onProgress: (msg, t) => setVp({ msg, t, on: true }) });
      setVid(URL.createObjectURL(blob));
    } catch (e) { setErr(String(e.message || e)); } finally { setVp({ msg: '', t: 0, on: false }); }
  };

  const doReject = async () => {
    const e = await rejectDocument(vr.id, rj || '');
    if (e) { setSaveErr({ form: e }); return; }
    actions.notify('Document rejected and kept on record');
    setRj(null); setStep(1); setParsed(null); setGeo(null); setVr(null);
  };

  const saveProperty = async () => {
    const village = geo?.village?.village || vals.village;
    const base = { village, villageCode: vals.villageCode, gat: vals.gat, area: vals.area, unit: 'H.R.Sq.m', type: extra.type, status: extra.status, planningAuthority: extra.planningAuthority, mou: extra.mou, soldHa: extra.soldHa, price: extra.price, taluka: enTaluka(vals.taluka) || vals.taluka, district: enDistrict(vals.district) || vals.district };
    const { errors, clean } = validateForm(base);
    setSaveErr(errors);
    if (Object.keys(errors).length) return;
    const parcel = geo.exact ? { pin: vals.gat, ha: geo.ha, c: geo.center, p: geo.rings } : { pin: vals.gat, ha: null, c: geo.center, p: [] };
    try {
      if (secure && !vr?.canProceed) { setSaveErr({ form: 'This 7/12 was not uploaded.' }); return; }
      const ha = toHectares(vals.area, 'H.R.Sq.m').ha;
      const edited = Object.keys(vals).filter((k) => ocrRef.current[k] !== undefined && String(vals[k] ?? '') !== String(ocrRef.current[k] ?? ''));
      const p = makeProperty({ ...clean, parcel, ha712: ha, ha, record712: { ...vals, _edited: edited }, agent: me.agent || extra.agent, approval: me.agent ? 'pending' : 'approved' }, 'doc712');
      if (secure) p.verificationId = vr.id;
      else if (fileRef.current) await saveOriginal(p.id, fileRef.current).catch(() => actions.notify('Could not keep a copy of the 7/12 file'));
      await saveNewProperty(p); actions.touch(); actions.notify(me.agent ? 'Sent to Admin for approval' : secure ? 'Selected — property added' : 'Property added');
      location.hash = (secure && me.isAdmin ? '#/video/' : '#/property/') + p.id;
    } catch (e) { setSaveErr({ form: String(e.message || e) }); }
  };

  const ha712 = haOf(vals.area);
  const diff = geo?.ha && ha712 ? (Math.abs(geo.ha - ha712) / ha712) * 100 : null;
  const showMap = geo && step >= MAPSTEP;

  return (
    <div className="page wiz">
      {!add && <div className="pagehead"><h1>New site</h1><p className="dim">{FEATURES.videoCreation ? '7/12 → details → map → KMZ → video' : '7/12 → details → map → KMZ'}</p></div>}

      <ol className="stepper">
        {steps.map((s, i) => (
          <li key={s} className={step === i + 1 ? 'on' : step > i + 1 ? 'done' : ''}>
            <button disabled={i + 1 > (geo ? steps.length : parsed ? (secure ? 3 : 2) : 1)} onClick={() => setStep(i + 1)}><i>{step > i + 1 ? '✓' : i + 1}</i>{s}</button>
          </li>
        ))}
      </ol>

      {err && <div className="werr">{err}</div>}

      {step === 1 && (
        <section className="wcard">
          <h2>Upload the 7/12</h2>
          <p className="dim">{secure ? 'Upload the 7/12 as a photo, a PDF or a Word file — a photo from WhatsApp is fine. It is stored privately, and every field is then confirmed against outside sources in the Verify step.' : 'A PDF or a clear photo of the 7/12. The Marathi text is read in your browser (nothing is uploaded anywhere). The first read downloads the Marathi language pack, so it takes a little longer.'}</p>
          <label className="drop">
            <input type="file" accept=".pdf,.docx,.doc,image/*" disabled={!!busy} onChange={(e) => e.target.files[0] && read(e.target.files[0])} />
            <b>Choose a 7/12 file</b><span>Photo, PDF or Word</span>
          </label>
          {!secure && <div className="row"><button className="btn ghost" disabled={!!busy} onClick={sample}>Use the sample 7/12 (Nanoshi, Gat 88)</button>{busy && <span className="dim">{busy}</span>}</div>}
          {secure && busy && <span className="dim">{busy}</span>}
          {secure && vr && (
            <div className={`vbox ${vr.canProceed ? 'ok' : 'bad'}`} role="status">
              {vr.canProceed
                ? <><b>✓ 7/12 received</b><p>Check the details next. Each field is then confirmed against outside sources.</p></>
                : <><b>This 7/12 cannot be accepted</b><p>{vr.error || vr.reason}</p></>}
            </div>
          )}
        </section>
      )}

      {step === 2 && parsed && (
        <section className="wcard">
          <div className="row between"><h2>Check the details</h2><span className="dim small">{fileName}</span></div>
          <p className="dim">Fields marked <span className="chip ok">read</span> matched the 7/12 layout. Fields marked <span className="chip warn">check</span> must be confirmed — OCR can confuse similar letters and digits. Edit anything that is wrong.</p>
          <div className="fgrid">
            {FIELDS.map(([k, label, hint]) => {
              const st = parsed.fields[k].status;
              const ok = st === 'ok' && vals[k] === parsed.fields[k].value;
              const en = k === 'district' ? enDistrict(vals.district) : k === 'taluka' ? enTaluka(vals.taluka) : '';
              return (
                <label key={k} className="wf">
                  <span>{label} <em className={`chip ${ok ? 'ok' : 'warn'}`}>{ok ? 'read' : 'check'}</em></span>
                  <input value={vals[k] || ''} onChange={(e) => setVals({ ...vals, [k]: e.target.value })} placeholder={hint} />
                  {en && <small className="dim">= {en}</small>}
                  {k === 'area' && parsed.areaTokens.length > 0 && <small className="dim">OCR saw: {parsed.areaTokens.join(' · ')} (digits are the least reliable part)</small>}
                </label>
              );
            })}
            <label className="wf wide"><span>Holders (one per line) <em className="chip warn">check</em></span>
              <textarea rows="4" value={vals.holders || ''} onChange={(e) => setVals({ ...vals, holders: e.target.value })} /></label>
          </div>
          <div className="row">
            <button className="btn" disabled={!!busy || !(vals.villageCode || vals.village)} onClick={secure ? () => setStep(3) : locate}>{busy || (secure ? 'Verify →' : 'Find on map →')}</button>
            <button className="btn ghost" onClick={() => setShowRaw(!showRaw)}>{showRaw ? 'Hide' : 'Show'} text read from the file</button>
            <button className="btn ghost" onClick={() => { setStep(1); setParsed(null); }}>Upload another</button>
          </div>
          {showRaw && <pre className="raw">{parsed.raw}</pre>}
        </section>
      )}

      {step === 3 && secure && parsed && vr?.id && (
        <section className="wcard">
          <div className="row between"><h2>Original satbara and the uploaded document</h2><span className="dim small">{fileName}</span></div>
          <GovCompare vid={vr.id} admin={me.isAdmin} p={{ taluka: enTaluka(vals.taluka) || vals.taluka, village: vals.village, gat: vals.gat, district: enDistrict(vals.district) || vals.district, villageCode: vals.villageCode }} mr={{ district: vals.district, taluka: vals.taluka, village: vals.villageMr || vals.village }} />
          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn" disabled={!!busy || !(vals.villageCode || vals.village)} onClick={locate}>{busy || 'Continue to location →'}</button>
            <button className="btn ghost" onClick={() => setStep(2)}>← Back to details</button>
          </div>
        </section>
      )}

      {showMap && (
        <div className="wsplit">
          <div className="wmap"><SiteMap key={`${geo.center}`} rings={geo.exact ? geo.rings : null} center={geo.center} exact={geo.exact} mode={mode} setMode={setMode} onMap={(m) => { mapRef.current = m; }} labels={{ sat: 'Satellite', terrain: 'Terrain' }} /></div>
          <div className="wside">
            {step === MAPSTEP && add && (
              <section className="wcard">
                <h2>{names().title}</h2>
                <p className="dim">{names().sub}</p>
                {geo.exact ? <p className="chip ok">✓ Exact plot boundary found ({geo.village.source})</p> : <p className="chip warn">Approximate location only — {geo.missingGat ? `gat ${vals.gat} is not in the ${geo.village.village} map` : 'no plot boundary for this village'}</p>}
                {geo.exact && <dl className="mini-kv"><dt>Plot area (map)</dt><dd>{geo.ha.toFixed(2)} ha</dd><dt>Area per 7/12</dt><dd>{ha712 ? `${ha712.toFixed(2)} ha` : 'enter it in step 2'}</dd>
                  {diff != null && <><dt>Difference</dt><dd className={diff < 2 ? 'gis-ok' : 'gis-warn'}>{diff < 2 ? '✓' : '⚠'} {diff.toFixed(1)}%</dd></>}</dl>}
                {saveErr.form && <div className="werr">{saveErr.form}</div>}
                {saveErr.gat && <div className="werr">{saveErr.gat}</div>}
                {saveErr.area && <div className="werr">Total area: {saveErr.area}</div>}
                {saveErr.village && <div className="werr">{saveErr.village}</div>}
                <label className="wf"><span>Type</span><select value={extra.type} onChange={(e) => setExtra({ ...extra, type: e.target.value })}>{TYPES.map((x) => <option key={x}>{x}</option>)}</select></label>
                <label className="wf"><span>Planning authority</span><select value={extra.planningAuthority} onChange={(e) => setExtra({ ...extra, planningAuthority: e.target.value })}>{AUTHORITIES.map((x) => <option key={x}>{x}</option>)}</select></label>
                <label className="wf"><span>MOU</span><span><input type="checkbox" checked={extra.mou} onChange={(e) => setExtra({ ...extra, mou: e.target.checked })} /> MOU completed</span></label>
                <label className="wf"><span>Area already sold (ha)</span><input value={extra.soldHa} onChange={(e) => setExtra({ ...extra, soldHa: e.target.value })} inputMode="decimal" placeholder="optional — Available area = total − sold" /></label>
                {!me.agent && <label className="wf"><span>Assigned agent</span><select value={extra.agent} onChange={(e) => setExtra({ ...extra, agent: e.target.value })}><option value="">— none —</option>{AGENTS.map((x) => <option key={x}>{x}</option>)}</select></label>}
                <label className="wf"><span>Status</span><select value={extra.status} onChange={(e) => setExtra({ ...extra, status: e.target.value })}>{STATUSES.map((x) => <option key={x}>{x}</option>)}</select></label>
                <label className="wf"><span>Price (lakh ₹)</span><input value={extra.price} onChange={(e) => setExtra({ ...extra, price: e.target.value })} inputMode="decimal" placeholder="optional" />{saveErr.price && <small className="ferr">{saveErr.price}</small>}</label>
                <div className="stack">
                  {!secure && <button className="btn" onClick={saveProperty}>Add property</button>}
                  {secure && me.isAdmin && <button className="btn" onClick={saveProperty}>Select</button>}
                  {secure && me.agent && <button className="btn" onClick={saveProperty}>Submit for Admin review</button>}
                  {secure && me.isAdmin && <button className="btn ghost danger" onClick={() => setRj('')}>Reject</button>}
                  <button className="btn ghost" onClick={() => setStep(secure ? 3 : 2)}>← Back</button>
                </div>
                {rj !== null && (
                  <div className="vreject">
                    <label>Reason for rejecting (kept on record)<textarea rows="2" value={rj} onChange={(e) => setRj(e.target.value)} /></label>
                    <div className="row"><button className="btn danger" disabled={rj.trim().length < 5} onClick={doReject}>Confirm reject</button><button className="btn ghost" onClick={() => setRj(null)}>Cancel</button></div>
                  </div>
                )}
              </section>
            )}
            {step === 3 && !add && (
              <section className="wcard">
                <h2>{names().title}</h2>
                <p className="dim">{names().sub}</p>
                {geo.exact ? <p className="chip ok">✓ Exact plot boundary found ({geo.village.source})</p> : <p className="chip warn">Approximate location only — {geo.missingGat ? `gat ${vals.gat} is not in the ${geo.village.village} map` : 'no plot boundary for this village'}</p>}
                {geo.exact && <dl className="mini-kv"><dt>Plot area (map)</dt><dd>{geo.ha.toFixed(2)} ha</dd><dt>Area per 7/12</dt><dd>{ha712 ? `${ha712.toFixed(2)} ha` : 'enter it in step 2'}</dd>
                  {diff != null && <><dt>Difference</dt><dd className={diff < 2 ? 'gis-ok' : 'gis-warn'}>{diff < 2 ? '✓' : '⚠'} {diff.toFixed(1)}%</dd></>}</dl>}
                {!geo.exact && <label className="drop small"><input type="file" accept=".kml" onChange={(e) => e.target.files[0] && addKml(e.target.files[0])} /><b>Add this village's KML</b><span>to get the exact plot outline</span></label>}
                <div className="stack">
                  <button className="btn" onClick={exportKmz}>Export KMZ</button>
                  <a className="btn ghost" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${geo.center[0]},${geo.center[1]}`}>Open in Google Maps ↗</a>
                  {FEATURES.videoCreation && <button className="btn" onClick={() => setStep(4)}>Next: site video →</button>}
                </div>
              </section>
            )}
            {step === 4 && !add && FEATURES.videoCreation && (
              <section className="wcard">
                <h2>Site video</h2>
                <p className="dim">A drone-style 3D orbit of the plot over real satellite imagery and terrain, with the site name on screen. It is recorded in your browser as a WebM file.</p>
                <label className="wf"><span>Length</span><select value={secs} onChange={(e) => setSecs(+e.target.value)}>{[8, 12, 20].map((s) => <option key={s} value={s}>{s} seconds</option>)}</select></label>
                <button className="btn" disabled={vp.on} onClick={makeVideo}>{vp.on ? `${vp.msg} ${Math.round(vp.t * 100)}%` : vid ? 'Make it again' : 'Generate site video'}</button>
                {vp.on && <div className="bar"><i style={{ width: `${vp.t * 100}%` }} /></div>}
                {vid && <><video className="wvid" src={vid} controls /><a className="btn ghost" href={vid} download={propFileName({ taluka: enTaluka(vals.taluka) || vals.taluka, village: names().v, gat: vals.gat }, 'webm')}>Download video (.webm)</a></>}
                <p className="small dim">Next level (planned): the same job on a server, producing MP4 with a voice-over and your logo.</p>
                <button className="btn ghost" onClick={() => setStep(3)}>← Back to map</button>
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
