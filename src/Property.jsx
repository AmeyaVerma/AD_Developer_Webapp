import { useState } from 'react';
import { canSee, useAuth } from './auth';
import ParcelMap from './ParcelMap';
import { PROPS, SATBARA_88, areaOf, hasOutline, propByGat, ratingStats, downloadKml } from './data';
import { actions, useStore } from './store';
import { shareText, whatsappUrl } from './share';
import Original712 from './Original712';
import VerifyPanel from './VerifyPanel';
import Review from './Review';
import MouSection from './MouSection';
import { FEATURES } from './features';
import { useT } from './i18n';
import { Section, Stars, StatusChip, propTitle, priceText } from './ui';

const WaIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12.04 2a9.9 9.9 0 00-8.4 15.1L2 22l5-1.6A9.9 9.9 0 1012.04 2zm5.8 14c-.25.7-1.45 1.35-2 1.4-.52.05-1.17.07-1.9-.16-.44-.14-1-.32-1.7-.63-3-1.3-4.95-4.3-5.1-4.5-.15-.2-1.2-1.6-1.2-3s.75-2.1 1-2.4c.25-.3.55-.35.75-.35h.55c.18 0 .42-.07.65.5.25.6.85 2.05.92 2.2.08.15.12.33.02.52-.1.2-.15.32-.3.5l-.45.5c-.15.15-.3.3-.13.6.17.3.75 1.25 1.62 2 1.1 1 2.05 1.3 2.35 1.45.3.15.47.12.65-.07.17-.2.75-.87.95-1.17.2-.3.4-.25.67-.15.27.1 1.7.8 2 .95.3.15.5.22.57.35.08.12.08.72-.17 1.42z" /></svg>
);

function Row({ k, children }) { return <div className="trow"><dt>{k}</dt><dd>{children}</dd></div>; }

export default function Property({ gat }) {
  const s = useStore();
  const { t, n, mr } = useT();
  const me = useAuth();
  const [mode, setMode] = useState('sat');
  const p = propByGat(gat);
  if (!p || !canSee(p, me.id)) return <div className="page"><p>{t('Not found')} · <a href="#/">{t('← All properties')}</a></p></div>;

  const st = ratingStats(s.reports, gat);
  const [la, lo] = p.parcel ? p.parcel.c : [null, null];
  const area = areaOf(p);
  const variance = p.ha712 && p.gis ? (Math.abs(p.gis - p.ha712) / p.ha712) * 100 : null;
  const reports = s.reports.filter((r) => r.gat === gat).sort((a, b) => b.date.localeCompare(a.date));
  const msgPublic = shareText(p, s.reports, 'public');
  const msgFull = shareText(p, s.reports, 'full');
  const copyMsg = async (text) => {
    try { await navigator.clipboard.writeText(text); actions.notify('Message copied'); } catch (e) { actions.notify('Could not copy — select the text in the preview'); }
  };

  return (
    <>
      <div className="page propgrid">
        <div className="main">
          <header className="phead">
            <a className="back" href="#/admin/props">{t('← All properties')}</a>
            <p className="stamp-lg">{t('Gat')} {n(p.gat)}</p>
            <h1>{propTitle(p, t, n)}</h1>
            <p className="dim">{[p.taluka, p.district, p.state].filter(Boolean).map((x) => t(x)).join(', ')} · {t(p.type)}</p>
            <div className="row">
              <StatusChip s={p.status} />
              {p.mou && <span className="chip ok">✓ {t('MOU completed')}{p.mouDate ? ` · ${new Date(p.mouDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}</span>}
              {p.approval === 'pending' && <span className="chip warn">{t('Pending approval')}</span>}
            </div>
          </header>

          {me.isAdmin && p.approval === 'pending' && p.verificationId && <Review p={p} />}

          <Section no="01" title={t('Particulars')}>
            <p className="lede">{t(p.desc)}</p>
            <dl className="ledger">
              <Row k={t('Gat / Survey no.')}><span className="mono">{n(p.gat)}</span></Row>
              <Row k={t('Village')}>{t(p.village)}</Row>
              <Row k={t('Taluka / District')}>{t(p.taluka || '—')} / {t(p.district || '—')}</Row>
              <Row k={t('State')}>{t(p.state)}</Row>
              <Row k={t('Type')}>{t(p.type)}</Row>
              <Row k={t('Area')}>{area ? <span className="mono">{n(area.toFixed(2))} {t('ha')} · {n((area * 2.471).toFixed(2))} {t('acres')} · {n(Math.round(area * 98.84))} {t('guntha')}</span> : '—'}</Row>
              {p.gis != null && <Row k={t('Area (map)')}><span className="mono">{n(p.gis.toFixed(2))} {t('ha')}</span> {variance != null && <span className={`chip ${variance < 2 ? 'ok' : 'warn'}`}>{variance < 2 ? '✓' : '⚠'} {n(variance.toFixed(1))}% {t('vs 7/12')}</span>}</Row>}
              <Row k={t('Price')}>{priceText(p, t, n)} {p.source === 'seed' && !p.real && <span className="chip mute">{t('sample')}</span>}</Row>
              {la != null && <Row k={t('Coordinates')}><span className="mono">{n(la.toFixed(5))}, {n(lo.toFixed(5))}</span></Row>}
            </dl>
            <div className="tags">{p.features.map((f) => <span key={f} className="tag">{t(f)}</span>)}</div>
          </Section>

          <Section no="02" title={t('Land record')} aside={p.real && <span className="chip info">{t('Source: client Satbara PDF')}</span>}>
            {p.real ? <><Satbara p={p} t={t} n={n} mr={mr} /><p style={{ marginTop: 12 }}><a className="btn ghost sm" href={`#/admin/report712?gat=${p.gat}`}>{t('Open Title Search Report')} →</a></p></> : p.record712 ? <RecordCard rec={p.record712} t={t} /> : <p className="dim">{t('7/12 not uploaded yet. In the full system the admin uploads the Satbara PDF and the fields are extracted and checked against the map.')}</p>}
          </Section>

          <Section no="03" title={t('Title Search Report')}>
            <Original712 p={p} height={520} />
            {p.verificationId && !(me.isAdmin && p.approval === 'pending') && <VerifyPanel vid={p.verificationId} vals={p.record712 || {}} admin={false} />}
            {p.approval !== 'pending' && <p style={{ marginTop: 12 }}><a className="btn ghost sm" href={`#/video/${p.id}`}>Create site video →</a></p>}
          </Section>

          <Section no="04" title={t('MOU document')} aside={p.mou && <span className="chip ok">{t('MOU completed')}</span>}>
            <MouSection p={p} admin={me.isAdmin} />
          </Section>

          <Section no="05" title={t('Site video')}>
            <Video gat={gat} />
          </Section>
        </div>

        <aside className="pside">
          <div className="mapcard">
            <ParcelMap list={PROPS} focus={gat} mode={mode} setMode={setMode} className="hero-map" />
          </div>
          {la == null ? <p className="chip warn">{t('No location yet — add latitude/longitude or the village KML')}</p> : (
            <div className="mapbtns">
              <a className="btn ghost sm" href={`https://www.google.com/maps/search/?api=1&query=${la},${lo}`} target="_blank" rel="noopener noreferrer">{t('Open in Google Maps')} ↗</a>
              <a className="btn ghost sm" href={`https://www.google.com/maps/dir/?api=1&destination=${la},${lo}`} target="_blank" rel="noopener noreferrer">{t('Get directions')} ↗</a>
              {hasOutline(p) && <button className="btn ghost sm" onClick={() => downloadKml(p)}>{t('Download boundary (.kml)')}</button>}
            </div>
          )}
          {FEATURES.whatsapp && (
            <div className="sharebox">
              <a className="btn wa" href={whatsappUrl(msgPublic)} target="_blank" rel="noopener noreferrer"><WaIcon />{t('Send Public Card')}</a>
              {me.isAdmin && <a className="btn wa wa2" href={whatsappUrl(msgFull)} target="_blank" rel="noopener noreferrer"><WaIcon />{t('Send Full details')}</a>}
              <p className="small dim wanote">{t('The public card has no owner or 7/12 details. Full details include the owners’ names and the land record.')}</p>
              <details>
                <summary>{t('Preview messages')}</summary>
                {[[t('Public card'), msgPublic], [t('Full details'), msgFull]].map(([label, text]) => (
                  <div key={label} className="prevblock">
                    <div className="row between"><b>{label}</b><button className="btn ghost sm" onClick={() => copyMsg(text)}>{t('Copy message')}</button></div>
                    <pre className="sharepre">{text}</pre>
                  </div>
                ))}
              </details>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

/** 7/12 fields as captured when the property was added from a document (shown as read from the file). */
function RecordCard({ rec, t }) {
  const rows = [['District', rec.district], ['Taluka', rec.taluka], ['Village', rec.village], ['Village code', rec.villageCode], ['Gat / Survey no.', rec.gat], ['PU-ID', rec.puid], ['Tenure', rec.tenure],
    ['Local field name', rec.localName], ['Total area (H.R.Sq.m)', rec.area], ['Holders', (rec.holders || '').split('\n').filter(Boolean).join(', ')], ['Pending mutation', rec.pending], ['Last mutation', rec.lastMut], ['Verification no.', rec.verifyNo]].filter(([, v]) => v);
  return (
    <div className="doc">
      <dl className="mr">{rows.map(([k, v]) => <div key={k} className="mrow"><dt>{t(k)}</dt><dd>{v}</dd></div>)}</dl>
      <p className="small dim">{t('Captured from the uploaded 7/12 and confirmed by the admin. Check against the signed original before relying on it.')}</p>
    </div>
  );
}

function Satbara({ p, t, n, mr }) {
  const b = SATBARA_88;
  const v = (Math.abs(p.gis - b.total) / b.total) * 100;
  const rows = mr ? [
    ['गाव / तालुका / जिल्हा', `${b.village} / ${b.taluka} / ${b.district}`],
    ['गट क्रमांक', b.gat], ['शेताचे स्थानिक नाव', b.localName], ['भूधारणा पद्धती', b.tenure],
    ['लागवडी योग्य क्षेत्र', `${n(b.cultivable.toFixed(2))} हे.आर`], ['पोटखराब क्षेत्र', `${n(b.potKharab.toFixed(2))} हे.आर`],
    ['एकूण क्षेत्र', `${n(b.total.toFixed(2))} हे.आर.`], ['आकारणी', `₹ ${n(b.assessment)}`],
    ['भोगवटादार (सध्याचे)', `${b.owners.join(', ')} (खाते ${b.khata})`], ['शेवटचा फेरफार', b.lastMutation],
    ['प्रलंबित फेरफार', b.pending], ['इतर अधिकार', b.otherRights], ['पीक (नमुना १२)', b.crop],
  ] : [
    ['Village / Taluka / District', 'Nanoshi (553456) / Panvel / Raigad'],
    ['Gat number', '88'], ['Local field name', 'Divticha Mal'], ['Tenure', 'Bhogwatdar Class-1'],
    ['Cultivable area', `${b.cultivable.toFixed(2)} ha`], ['Pot-kharab (uncultivable) area', `${b.potKharab.toFixed(2)} ha`],
    ['Total area', `${b.total.toFixed(2)} ha`], ['Assessment', `₹ ${b.assessment}`],
    ['Current holders', 'Ajay Mahadev Jadhav, Sanjay Mahadev Jadhav (Khata 223)'], ['Last mutation', 'No. 848 (10/11/2024)'],
    ['Pending mutation', 'None'], ['Other rights', 'Pandya & Co. Solicitors (21); V. D. Ghenar (21)'], ['Crop (Form 12)', '2023-24 Kharif – fallow (2.33.00)'],
  ];
  const history = mr ? b.history
    : ['Chhaya Rajaram Patil (Khata 146, 170)', 'Collector & Deputy Custodian, Evacuee Property (Khata 154)', 'Satish Balaso Patil (Khata 200)'];
  return (
    <div className="doc">
      <dl className={mr ? 'mr' : ''}>
        {rows.map(([k, val]) => <div key={k} className="mrow"><dt>{k}</dt><dd>{val}</dd></div>)}
      </dl>
      <details><summary>{t('Earlier holders')}</summary><ul className={mr ? 'mr' : ''}>{history.map((h) => <li key={h}>{h}</li>)}</ul></details>
      <p className="small dim mono">PU-ID {b.puid} · {b.downloaded} · {b.verifyId}</p>
      <div className="check"><b>{t('Automated check')}:</b> {t('Area (7/12)')} {n(b.total.toFixed(2))} {t('ha')} ↔ {t('Area (map)')} {n(p.gis.toFixed(2))} {t('ha')} → <strong>✓ {n(v.toFixed(1))}% · {t('Boundary consistent with the map')}</strong></div>
    </div>
  );
}

const KINDS = { buyer: 'Prospective buyer', inspector: 'Inspector', team: 'Site team' };

function Reports({ gat, st, reports }) {
  const { t, n } = useT();
  return (
    <>
      {st && (
        <div className="summary">
          <div><div className="bignum">{n(st.avg.toFixed(1))}</div><Stars v={st.avg} /><div className="small dim">{n(st.n)} {t('site visits')}</div></div>
          <div className="bars">{[5, 4, 3, 2, 1].map((i) => <div key={i}><span className="mono">{n(i)}</span><i style={{ width: `${(st.d[i - 1] / st.n) * 140}px` }} /><span className="mono dim">{n(st.d[i - 1])}</span></div>)}</div>
        </div>
      )}
      {reports.map((r) => (
        <article key={r.id} className="review">
          <div className="row wrap"><strong>{r.author}</strong>
            <span className={`chip ${r.kind === 'buyer' ? 'ok' : 'info'}`}>{t(KINDS[r.kind])}</span>
            <span className="dim small mono">{n(r.date)}</span>
            <span className="grow" /><button className="linkbtn" onClick={() => actions.removeReport(r.id)}>{t('Remove')}</button></div>
          <div className="small"><Stars v={r.overall} /> <span className="dim">{t('Location')} {n(r.loc)}/{n(5)} · {t('Condition')} {n(r.cond)}/{n(5)} · {t('Value')} {n(r.val)}/{n(5)} · {t('Felt')} {t(r.feeling)}</span></div>
          <p>{r.body}</p>
        </article>
      ))}
      {!reports.length && <p className="dim">{t('No site visit reports yet.')}</p>}
      <ReportForm gat={gat} />
    </>
  );
}

function ReportForm({ gat }) {
  const { t, n } = useT();
  const [f, setF] = useState({ author: '', kind: 'buyer', overall: 4, loc: 4, cond: 4, val: 4, feeling: 'positive', body: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const Rate = ({ k, label }) => <label>{t(label)}<select value={f[k]} onChange={(e) => setF({ ...f, [k]: +e.target.value })}>{[5, 4, 3, 2, 1].map((i) => <option key={i} value={i}>{n(i)}</option>)}</select></label>;
  return (
    <form className="rform" onSubmit={(e) => { e.preventDefault(); actions.addReport({ ...f, gat, author: f.author.trim() }); setF({ ...f, author: '', body: '' }); }}>
      <h3>{t('Add site visit report')}</h3>
      <div className="grid2">
        <label>{t('Visitor name')}<input required maxLength={60} value={f.author} onChange={set('author')} /></label>
        <label>{t('Visitor type')}<select value={f.kind} onChange={set('kind')}>{Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}</select></label>
      </div>
      <div className="grid5"><Rate k="overall" label="Overall" /><Rate k="loc" label="Location" /><Rate k="cond" label="Condition" /><Rate k="val" label="Value" />
        <label>{t('How did the visit feel?')}<select value={f.feeling} onChange={set('feeling')}>{['positive', 'neutral', 'negative'].map((x) => <option key={x} value={x}>{t(x)}</option>)}</select></label></div>
      <label>{t('Notes')}<textarea rows="3" required minLength={10} maxLength={800} value={f.body} onChange={set('body')} placeholder={t('What did the visitor see and say? (min 10 characters)')} /></label>
      <div><button className="btn">{t('Add report')}</button></div>
    </form>
  );
}

function Video({ gat }) {
  const s = useStore();
  const { t } = useT();
  const url = s.videos[gat];
  return (
    <>
      <div className="video">{url ? <video controls src={url} /> : <div><div className="play">▶</div><b>{t('Video coming soon')}</b><p>{t('Attach the drone / walkthrough video below once the company provides it.')}</p></div>}</div>
      <label className="up">{t('Attach video (preview only in this demo)')}<input type="file" accept="video/*" onChange={(e) => e.target.files[0] && actions.attachVideo(gat, URL.createObjectURL(e.target.files[0]))} /></label>
    </>
  );
}
