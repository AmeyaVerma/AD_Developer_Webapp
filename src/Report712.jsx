import { useState } from 'react';
import { PROPS, propByGat, propFileName } from './data';
import Original712 from './Original712';
import VerifyPanel from './VerifyPanel';
import Wizard from './Wizard';
import { canSee, useAuth } from './auth';
import { RECORDS, hasRecord } from './record712';
import { TODAY } from './store';
import { useT } from './i18n';

// Labels follow the official Form 7 / Form 12 headings (Marathi) with an English translation.
const LBL = {
  mr: {
    f7: 'गाव नमुना सात', f7s: 'अधिकार अभिलेख पत्रक',
    rule7: 'महाराष्ट्र जमीन महसूल अधिकार अभिलेख आणि नोंदवह्या (तयार करणे व सुस्थितीत ठेवणे) नियम १९७१ यातील नियम ३,५,६ आणि ७',
    village: 'गाव', taluka: 'तालुका', district: 'जिल्हा', puid: 'PU-ID', gat: 'गट क्रमांक व उपविभाग', tenure: 'भुधारणा पद्धती', local: 'शेताचे स्थानीक नाव',
    hArea: 'क्षेत्र, एकक व आकारणी', hKhata: 'खाते क्र.', hHolder: 'भोगवटादाराचे नाव', hQty: 'क्षेत्र', hAakar: 'आकार', hPot: 'पो.ख.', hMut: 'फेरफार क्र', hRights: 'कुळ, खंड व इतर अधिकार',
    unit: 'क्षेत्राचे एकक हे.आर.चौ.मी', cult: 'अ) लागवड योग्य क्षेत्र', jira: 'जिरायत', baga: 'बागायत', cultTotal: 'एकूण ला.यो. क्षेत्र',
    pot: 'ब) पोटखराब क्षेत्र (लागवड अयोग्य)', clsA: 'वर्ग (अ)', clsB: 'वर्ग (ब)', potTotal: 'एकूण पो.ख.क्षेत्र', total: 'एकूण क्षेत्र (अ+ब)', assess: 'आकारणी', judi: 'जुडी किंवा विशेष आकारणी',
    tenant: 'कुळाचे नाव व खंड', other: 'इतर अधिकार', otherSub: 'इतर', pending: 'प्रलंबित फेरफार :', lastMut: (no) => `शेवटचा फेरफार क्रमांक : ${no} व दिनांक :`, common: 'सामाईक क्षेत्र',
    oldMut: 'जुने फेरफार क्र :', marks: 'सीमा आणि भुमापन चिन्हे :',
    f12: 'गाव नमुना बारा', f12s: 'पिकांची नोंदवही', rule12: 'महाराष्ट्र जमीन महसूल अधिकार अभिलेख आणि नोंदवह्या (तयार करणे व सुस्थितीत ठेवणे) नियम १९७१ यातील नियम २९',
    year: 'वर्षे', season: 'हंगाम', khata: 'खाते क्रमांक', cropArea: 'पिकाखालील क्षेत्राचा तपशील', cropType: 'पिकाचा प्रकार', cropName: 'पिकांचे नाव', irrig: 'जल सिंचित', unirrig: 'अजल सिंचित', source: 'जल सिंचनाचे साधन',
    unavail: 'लागवडीसाठी उपलब्ध नसलेली जमीन', nature: 'स्वरूप', qty: 'क्षेत्र', remarks: 'शेरा', unit12: 'हे.आर.चौ.मी', note12: 'टीप : ** सदरची नोंद मोबाइल अॅप द्वारे घेण्यात आलेली आहे',
    foot: (r, n = (x) => x) => `हा माहितीसाठीचा अहवाल AB Developers ने डिजिटल स्वाक्षरीत ७/१२ वरून तयार केला आहे (गाव नमुना ७ दिनांक ${n(r.signedAt)}, डाउनलोड दि. ${n(r.downloadedAt)}). हा कायदेशीर दस्तऐवज नाही. वैधता पडताळणीसाठी digitalsatbara.mahabhumi.gov.in/dslr/ येथे ${r.verifyNo} हा क्रमांक वापरा.`,
  },
  en: {
    f7: 'Village Form 7', f7s: 'Record of Rights',
    rule7: 'Maharashtra Land Revenue (Record of Rights and Registers) (Preparation and Maintenance) Rules 1971 — Rules 3, 5, 6 and 7',
    village: 'Village', taluka: 'Taluka', district: 'District', puid: 'PU-ID', gat: 'Gat no. & sub-division', tenure: 'Tenure', local: 'Local name of field',
    hArea: 'Area, unit & assessment', hKhata: 'Khata no.', hHolder: 'Name of holder', hQty: 'Area', hAakar: 'Assessment', hPot: 'Pot-kharab', hMut: 'Mutation no.', hRights: 'Tenant, rent & other rights',
    unit: 'Unit of area: Ha.R.Sq.m', cult: 'A) Cultivable area', jira: 'Jirayat (dry)', baga: 'Bagayat (irrigated)', cultTotal: 'Total cultivable area',
    pot: 'B) Pot-kharab (uncultivable) area', clsA: 'Class (A)', clsB: 'Class (B)', potTotal: 'Total pot-kharab area', total: 'Total area (A+B)', assess: 'Assessment', judi: 'Judi or special assessment',
    tenant: 'Tenant name & rent', other: 'Other rights', otherSub: 'Others', pending: 'Pending mutation :', lastMut: (no) => `Last mutation no. : ${no} dated :`, common: 'Common area',
    oldMut: 'Old mutation nos. :', marks: 'Boundary & survey marks :',
    f12: 'Village Form 12', f12s: 'Crop Register', rule12: 'Maharashtra Land Revenue (Record of Rights and Registers) (Preparation and Maintenance) Rules 1971 — Rule 29',
    year: 'Year', season: 'Season', khata: 'Khata no.', cropArea: 'Area under crops', cropType: 'Crop type', cropName: 'Crop name', irrig: 'Irrigated', unirrig: 'Unirrigated', source: 'Irrigation source',
    unavail: 'Land not available for cultivation', nature: 'Nature', qty: 'Area', remarks: 'Remarks', unit12: 'Ha.R.Sq.m', note12: 'Note : ** This entry was captured through the mobile app',
    foot: (r) => `Information copy prepared by AB Developers from the digitally signed 7/12 (Form 7 signed ${r.signedAt}, downloaded ${r.downloadedAt}). This is not a legal document. To verify, enter no. ${r.verifyNo} at digitalsatbara.mahabhumi.gov.in/dslr/.`,
  },
};

const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

function Sheet7({ r, L, lang, n, no, of }) {
  const pick = (x) => x[lang];
  return (
    <section className="sheet" aria-label={L.f7}>
      <div className="sh-head">
        <p className="sh-title"><b>{L.f7}</b> ({L.f7s})</p>
        <p className="sh-rule">[ {L.rule7} ]</p>
        <div className="sh-row3"><span>{L.village} :- <b>{pick(r.village)}</b></span><span>{L.taluka} :- <b>{pick(r.taluka)}</b></span><span>{L.district} :- <b>{pick(r.district)}</b></span></div>
        <div className="sh-row2"><span>{L.puid} : <b>{r.puid}</b></span><span>{L.gat} &nbsp; {n(r.gat)}</span></div>
      </div>
      <div className="sh-tenure"><span>{L.tenure} &nbsp; <b>{pick(r.tenure)}</b></span><span>{L.local} : <b>{pick(r.localName)}</b></span></div>

      <div className="f7">
        <div className="f7-h"><span>{L.hArea}</span>
          <div className="f7-mid"><span>{L.hKhata}</span><span>{L.hHolder}</span><span className="c">{L.hQty}</span><span className="c">{L.hAakar}</span><span className="c">{L.hPot}</span><span className="c">{L.hMut}</span></div>
          <span>{L.hRights}</span></div>
        <div className="f7-b">
          <div className="f7-left">
            <p>{L.unit}</p>
            <p>{L.cult}</p>
            <p>{L.jira} &nbsp; {n(r.areas.jirayat)}</p>
            <p>{L.baga} &nbsp; {n(r.areas.bagayat)}</p>
            <p>{L.cultTotal} &nbsp; {n(r.areas.cultivableTotal)}</p>
            <hr />
            <p>{L.pot}</p>
            <p>{L.clsA} &nbsp; {n(r.areas.potA)}</p>
            <p>{L.clsB} &nbsp; {n(r.areas.potB)}</p>
            <p>{L.potTotal} &nbsp; {n(r.areas.potTotal)}</p>
            <hr />
            <p>{L.total} &nbsp; <b>{n(r.areas.total)}</b></p>
            <hr />
            <p>{L.assess} &nbsp; <b>{n(r.areas.aakar)}</b></p>
            <hr />
            <p>{L.judi}</p>
          </div>
          <div className="f7-mid-body">
            {r.khatas.map((k) => (
              <div className="khata" key={k.khata}>
                {k.entries.map((e, i) => (
                  <div className="f7-mid" key={i}>
                    <span>{i === 0 ? n(k.khata) : ''}</span>
                    <span className="holder">{e.area ? '[' : (k.entries.length > 1 ? '[' : '')} <u>{pick(e.o)}</u></span>
                    <span className="c">{e.area ? <u>{n(e.area)}</u> : ''}</span>
                    <span className="c">{e.aakar ? <u>{n(e.aakar)}</u> : ''}</span>
                    <span className="c">{e.pot ? <><u>{n(e.pot)}</u> ]</> : (k.entries.length > 1 ? ']' : '')}</span>
                    <span className="c">({n(e.mut)})</span>
                  </div>
                ))}
                {k.common && (
                  <div className="f7-mid common"><span /><span>------{L.common}------</span><span className="c">{n(k.common.area)}</span><span className="c">{n(k.common.aakar)}</span><span className="c">{k.common.pot ? n(k.common.pot) : ''}</span><span /></div>
                )}
              </div>
            ))}
          </div>
          <div className="f7-right">
            <p>{L.tenant}</p>
            <hr />
            <p>{L.other}</p>
            <p>{L.otherSub}</p>
            {r.otherRights.map((o, i) => <p key={i}><b>{pick(o)}</b></p>)}
            <hr />
            <p>{L.pending} <b>{pick(r.pending)}</b></p>
            <hr />
            <p>{L.lastMut(n(r.lastMutation.no))}</p>
            <p>{n(r.lastMutation.date)}</p>
          </div>
        </div>
      </div>
      <div className="f7-foot"><span>{L.oldMut} {r.oldMutations.map((m) => `(${n(m)})`).join(' ')}</span><span>{L.marks}</span></div>
      <p className="sh-note">{L.foot(r, n)}</p>
      <p className="sh-page">{lang === 'mr' ? 'पृष्ठ क्र.' : 'Page'} {n(no)}/{n(of)}</p>
    </section>
  );
}

function Sheet12({ r, L, lang, n, no, of }) {
  const pick = (x) => x[lang];
  return (
    <section className="sheet" aria-label={L.f12}>
      <div className="sh-head">
        <p className="sh-title"><b>{L.f12}</b> ({L.f12s})</p>
        <p className="sh-rule">[ {L.rule12} ]</p>
        <div className="sh-row3"><span>{L.village} :- <b>{pick(r.village)}</b></span><span>{L.taluka} :- <b>{pick(r.taluka)}</b></span><span>{L.district} :- <b>{pick(r.district)}</b></span></div>
        <div className="sh-row2"><span>{L.gat} &nbsp; {n(r.gat)}</span><span /></div>
      </div>
      <table className="f12">
        <thead>
          <tr><th rowSpan="3">{L.year}</th><th rowSpan="3">{L.season}</th><th rowSpan="3">{L.khata}</th><th colSpan="5">{L.cropArea}</th><th colSpan="2">{L.unavail}</th><th rowSpan="3">{L.remarks}</th></tr>
          <tr><th rowSpan="2">{L.cropType}</th><th rowSpan="2">{L.cropName}</th><th>{L.irrig}</th><th>{L.unirrig}</th><th rowSpan="2">{L.source}</th><th rowSpan="2">{L.nature}</th><th rowSpan="2">{L.qty}</th></tr>
          <tr><th>{L.unit12}</th><th>{L.unit12}</th></tr>
        </thead>
        <tbody>
          {r.form12.map((f, i) => (
            <tr key={i}><td>{n(f.year)}</td><td>{pick(f.season)}</td><td>{n(f.khata)}</td><td /><td /><td /><td /><td /><td><b>{pick(f.unavail)}</b></td><td>{n(f.unavailArea)}</td><td /></tr>
          ))}
        </tbody>
      </table>
      <p className="sh-note">{L.note12}</p>
      <p className="sh-note">{L.foot(r, n)}</p>
      <p className="sh-page">{lang === 'mr' ? 'पृष्ठ क्र.' : 'Page'} {n(no)}/{n(of)}</p>
    </section>
  );
}


/** The six check cards shown at the top of a Title Search Report. */
export function buildChecks(r, prop, lang, t, n) {
  if (!r) return [];
  const mapHa = prop ? prop.gis : null;
  const totalHa = Number(r.areas.total.split('.').slice(0, 2).join('.')); // H.R -> hectares
  const variance = mapHa ? (Math.abs(mapHa - totalHa) / totalHa) * 100 : null;
  const age = daysBetween(r.downloadedISO, TODAY);
  return [
    { ok: true, k: 'Holders', v: [...new Set(r.khatas.at(-1).entries.map((e) => e.o[lang]))].join(', '), note: `${t('Khata')} ${n(r.khatas.at(-1).khata)} · ${t('joint (common area)')}` },
    ...(variance != null ? [{ ok: variance < 2, k: 'Area: 7/12 vs map', v: `${n(totalHa.toFixed(2))} ${t('ha')} ↔ ${n(mapHa.toFixed(2))} ${t('ha')} (${n(variance.toFixed(1))}%)`, note: variance < 2 ? t('Boundary consistent with the map') : t('Large difference — check the boundary') }] : []),
    { ok: true, k: 'Pending mutation', v: r.pending[lang], note: `${t('Last mutation')} ${n(r.lastMutation.no)} · ${n(r.lastMutation.date)}` },
    { ok: false, warn: true, k: 'Other rights recorded', v: r.otherRights.map((o) => o[lang]).join('; '), note: t('Confirm what these entries mean before any purchase') },
    { ok: age <= 30, warn: age > 30, k: 'Record age', v: `${n(age)} ${t('days old')}`, note: age > 30 ? t('Download a fresh 7/12 before any transaction') : t('Recent') },
    { ok: true, info: true, k: 'Crop register', v: `${n(r.form12[0].year)} · ${r.form12[0].unavail[lang]}`, note: t('Latest crop entry on record') },
  ];
}

/** Section on the property page: the summary of the Title Search Report, with a link to the full report. */
export function TitleSummary({ p }) {
  const { t, n, lang } = useT();
  const r = hasRecord(p.id) ? RECORDS[p.id] : null;
  if (!r) {
    return (
      <div className="card-empty">
        <b>{p.record712 ? t('A 7/12 was captured for this property, but a full Title Search needs the 7/12 fully transcribed (currently Gat 88).') : t('No Title Search yet — add a 7/12 for this property.')}</b>
        <p className="dim small">{t('The report is built from the signed 7/12: holders, area check against the map, pending mutation, other rights and record age.')}</p>
      </div>
    );
  }
  const checks = buildChecks(r, p, lang, t, n);
  return (
    <div className="rsum" style={{ margin: 0 }}>
      <div className="rchecks" style={{ marginTop: 0 }}>
        {checks.map((c) => (
          <div key={c.k} className={`rcheck ${c.info ? 'info' : c.ok ? 'ok' : 'warn'}`}>
            <span className="rc-i">{c.info ? 'i' : c.ok ? '✓' : '!'}</span>
            <div><small>{t(c.k)}</small><b>{c.v}</b><em>{c.note}</em></div>
          </div>
        ))}
      </div>
      <div className="row wrap"><a className="btn sm" href={`#/admin/report712?gat=${p.id}`}>{t('Open Title Search')} →</a></div>
      <p className="small dim">{t('Information summary prepared from the 7/12 — not a legal title opinion. Have an advocate verify the ownership chain before a purchase.')}</p>
    </div>
  );
}

function csvOf(r, lang) {
  const p = (x) => x[lang];
  const rows = [['Field', 'Value'],
    ['Village', p(r.village)], ['Taluka', p(r.taluka)], ['District', p(r.district)], ['PU-ID', r.puid], ['Gat no.', r.gat], ['Tenure', p(r.tenure)], ['Local name', p(r.localName)],
    ['Cultivable (jirayat) Ha.R.Sq.m', r.areas.jirayat], ['Pot-kharab Ha.R.Sq.m', r.areas.potTotal], ['Total area Ha.R.Sq.m', r.areas.total], ['Assessment', r.areas.aakar],
    ['Other rights', r.otherRights.map(p).join('; ')], ['Pending mutation', p(r.pending)], ['Last mutation', `${r.lastMutation.no} (${r.lastMutation.date})`],
    ['Signed', r.signedAt], ['Downloaded', r.downloadedAt], ['Verification no.', r.verifyNo], [],
    ['Khata', 'Holder', 'Area', 'Assessment', 'Pot-kharab', 'Mutation']];
  r.khatas.forEach((k) => k.entries.forEach((e) => rows.push([k.khata, p(e.o), e.area || '', e.aakar || '', e.pot || '', e.mut])));
  const csv = '﻿' + rows.map((x) => x.map((c) => '"' + String(c ?? '').replace(/"/g, '""') + '"').join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = propFileName(propByGat(String(r.gat)) || { gat: r.gat, village: r.village.en, taluka: r.taluka.en }, 'csv');
  a.click();
}

export default function Report712() {
  const { t, n } = useT();
  const me = useAuth();
  const visible = PROPS.filter((p) => canSee(p, me.id));
  const params = new URLSearchParams((location.hash.split('?')[1]) || '');
  const q = params.get('gat');
  const [tab, setTab] = useState(params.get('new') ? 'new' : 'docs');
  const [id, setId] = useState(visible.some((p) => p.id === q) ? q : (visible[0]?.id || ''));
  const prop = propByGat(id);
  return (
    <>
      <div className="tabs2" role="tablist">
        <button role="tab" aria-selected={tab === 'new'} className={tab === 'new' ? 'on' : ''} onClick={() => setTab('new')}>Upload new 7/12</button>
        <button role="tab" aria-selected={tab === 'docs'} className={tab === 'docs' ? 'on' : ''} onClick={() => setTab('docs')}>Documents on file</button>
      </div>
      {tab === 'new' && <Wizard mode="add" />}
      {tab === 'docs' && (
        <>
          <div className="rsearch" style={{ alignItems: 'end' }}>
            <label>{t('Property')}
              <select value={id} onChange={(e) => setId(e.target.value)}>
                {visible.map((p) => <option key={p.id} value={p.id}>{[p.taluka, p.village].filter(Boolean).join(' - ')} · {t('Gat')} {n(p.gat)}</option>)}
              </select>
            </label>
          </div>
          <p className="small dim">{t('This is the original 7/12 exactly as uploaded.')}</p>
          {prop && <Original712 p={prop} height={760} />}
          {prop?.verificationId && <VerifyPanel vid={prop.verificationId} vals={prop.record712 || {}} admin={false} />}
        </>
      )}
    </>
  );
}
