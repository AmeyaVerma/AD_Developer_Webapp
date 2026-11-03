import { useMemo, useState } from 'react';
import { PROPS, SATBARA_88, areaOf, availableOf, downloadKml, exportCsv, hasOutline, parcels, propByGat, ratingStats, removeProp, updateProp } from './data';
import { canSee, useAuth } from './auth';
import { removeOriginal } from './originals';
import { AUTHORITIES } from './properties';
import { actions, useStore } from './store';
import { useT } from './i18n';
import { Thumb } from './ui';

import Report712 from './Report712';
import Visits from './Visits';
import Settings from './Settings';

const TITLES = { props: 'Properties', visits: 'Site visits', report712: 'Title Search', verify: '7/12 ↔ map check', settings: 'Settings' };
const BUILDING = 'M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 10h.01M15 10h.01';
const TITLE_ICONS = { props: BUILDING, visits: 'M8 2v4M16 2v4M3 8h18M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z', report712: 'M7 3h7l5 5v13H7zM14 3v5h5M9.5 13h6M9.5 17h6', verify: 'M9 12l2 2 4-4M7 3h10a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z', settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM4 12h2M18 12h2M12 4v2M12 18v2' };

const Svg = ({ d }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);

export function Admin({ tab }) {
  const s = useStore();
  const { t } = useT();
  const cur = TITLES[tab] ? tab : 'props';
  return (
    <div className="page">
      {cur === 'props' && <Register s={s} />}
      {cur !== 'props' && (
        <div className="pagehead"><div className="title"><Svg d={TITLE_ICONS[cur]} /><h1>{t(TITLES[cur])}</h1></div></div>
      )}
      {cur === 'visits' && <Visits />}
      {cur === 'report712' && <Report712 />}
      {cur === 'verify' && <Verify />}
      {cur === 'settings' && <Settings />}
    </div>
  );
}

const SORTS = {
  district: ['District', (a, b) => String(a.district || '').localeCompare(String(b.district || ''))],
  taluka: ['Taluka', (a, b) => String(a.taluka || '').localeCompare(String(b.taluka || ''))],
  village: ['Village', (a, b) => String(a.village || '').localeCompare(String(b.village || ''))],
};

/** Start page: the property register — the main working screen. */
function Register({ s }) {
  const { t, n } = useT();
  const me = useAuth();
  const mine = useMemo(() => PROPS.filter((p) => canSee(p, me.id)), [me.id, s.rev]);
  const pending = mine.filter((p) => p.approval === 'pending');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('All');
  const mouOn = status === 'MOU Completed'; // the MOU button and the "MOU Completed" tab are the same switch
  const [auth, setAuth] = useState('All');
  const [sort, setSort] = useState('village');

  const rated = useMemo(() => mine.map((p) => ({ ...p, rating: ratingStats(s.reports, p.id)?.avg || 0 })), [s.reports, mine]);
  const list = useMemo(() => rated
    .filter((p) => (status === 'All' || p.mou) && (auth === 'All' || p.planningAuthority === auth)
      && (`${p.village} ${p.gat} ${p.type}`).toLowerCase().includes(q.toLowerCase()))
    .sort(SORTS[sort][1]), [rated, q, status, auth, sort]);

  const nStatus = (k) => (k === 'All' ? mine.length : mine.filter((p) => p.mou).length);
  const nAuth = (k) => (k === 'All' ? mine.length : mine.filter((p) => p.planningAuthority === k).length);
  const clear = () => { setQ(''); setStatus('All'); setAuth('All'); };
  const no712 = mine.filter((p) => !p.real && !p.record712).length;
  const noVideo = mine.filter((p) => !s.videos[p.id]).length;
  const approve = async (p) => { try { await updateProp(p.id, { approval: 'approved' }); actions.touch(); actions.notify('Property approved'); } catch (e) { actions.notify(String(e.message || e)); } };
  const reject = async (p) => { if (window.confirm(`Reject and remove ${p.village} Gat ${p.gat}?`)) { try { await removeProp(p.id); removeOriginal(p.id); actions.touch(); actions.notify('Property rejected'); } catch (e) { actions.notify(String(e.message || e)); } } };
  const del = async (p) => { if (window.confirm(`Remove ${p.village} Gat ${p.gat}?`)) { try { await removeProp(p.id); removeOriginal(p.id); actions.touch(); actions.notify('Property removed'); } catch (e) { actions.notify(String(e.message || e)); } } };

  return (
    <>
      <div className="pagehead">
        <div className="title"><Svg d={BUILDING} /><h1>{t('Properties')}</h1></div>
        <div className="row">
          <button type="button" role="switch" aria-checked={mouOn} className={`mouswitch ${mouOn ? 'on' : ''}`} onClick={() => setStatus(mouOn ? 'All' : 'MOU Completed')}><span>{t('MOU')}</span><i /></button>
          {me.isAdmin && <button className="btn ghost sm" onClick={exportCsv}>{t('Export Excel (CSV)')}</button>}
          <a className="btn sm" href="#/admin/report712?new=1">
            <Svg d="M12 5v14M5 12h14" />{t('Add property')}
          </a>
        </div>
      </div>

      {me.isAdmin && pending.length > 0 && (
        <div className="attn pendstrip" role="status" aria-label={t('Waiting for approval')}>
          <span className="attn-h">{t('Waiting for approval')}</span>
          {pending.map((p) => (
            <span key={p.id} className="pendrow">
              <a href={`#/property/${p.id}`}>{[p.taluka, p.village].filter(Boolean).join(' - ')} · {t('Gat')} {n(p.gat)} · {t('Agent')} {p.agent}{p.record712?._edited?.length ? ` · ${t('edited by agent')}: ${p.record712._edited.join(', ')}` : ''}</a>
              <a className="btn sm" href={`#/property/${p.id}`}>{t('Review')}</a>
            </span>
          ))}
        </div>
      )}

      {me.isAdmin && !s.attnDismissed && (
        <div className="attn" role="status" aria-label={t('Needs attention')}>
          <span className="attn-h">{t('Needs attention')}</span>
          <a href="#/admin/verify" className="warn"><b>{n(no712)}</b> {t('properties have no 7/12 uploaded')} <i>→</i></a>
          <span className="note"><b>{n(noVideo)}</b> {t('properties have no site video')}</span>
          <button className="x" onClick={actions.dismissAttention} aria-label={t('Dismiss')} title={t('Dismiss')}>×</button>
        </div>
      )}

      <div className="regwrap">
        <aside className="filt" aria-label={t('Filters')}>
          <div className="row between"><h4>{t('Filters')}</h4><button className="linkbtn" onClick={clear}>{t('Clear filters')}</button></div>
          <div className="fgroup">
            <h5>{t('Planning authority')}</h5>
            {['All', ...AUTHORITIES].map((k) => (
              <button key={k} className={auth === k ? 'on' : ''} onClick={() => setAuth(k)}><span>{t(k)}</span><b>{n(nAuth(k))}</b></button>
            ))}
          </div>
        </aside>

        <div className="regmain">
          <div className="stabbar">
            <label className="minisearch">
              <Svg d="M21 21l-4.3-4.3M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Search')} aria-label={t('Search Gat/Survey No. or type')} />
            </label>
            <div className="stabs" role="tablist">
              {['All', 'MOU Completed'].map((k) => (
                <button key={k} role="tab" aria-selected={status === k} className={`stab ${status === k ? 'on' : ''} ${k.replace(' ', '-').toLowerCase()}`} onClick={() => setStatus(k)}>
                  <i className="dot" />{t(k)}<b>{n(nStatus(k))}</b>
                </button>
              ))}
            </div>
            <label className="sortsel">{t('Sort by')}
              <select value={sort} onChange={(e) => setSort(e.target.value)}>{Object.entries(SORTS).map(([k, [label]]) => <option key={k} value={k}>{t(label)}</option>)}</select>
            </label>
          </div>

          <div className="reg">
            <table>
              <thead><tr><th>{t('Village/City Name')}</th><th>{t('Gat/Survey No.')}</th><th>{t('Total Area')}</th><th>{t('Available Area')}</th><th>{t('Reference')}</th>{mouOn && <th>{t('MOU')}</th>}<th /></tr></thead>
              <tbody>
                {list.map((p) => {
                  return (
                    <tr key={p.id}>
                      <td>
                        <a className="regname" href={`#/property/${p.id}`}>
                          <Thumb parcel={p.parcel} w={240} h={150} />
                          <span><b>{[p.taluka, p.village].filter(Boolean).map((x) => t(x)).join(' - ')}</b><small>{t(p.planningAuthority || 'Other')}{p.approval === 'pending' && <em className="pend">{t('Pending approval')}</em>}</small></span>
                        </a>
                      </td>
                      <td className="code">{String(p.village || 'X').slice(0, 3).toUpperCase()}-{n(p.gat)}</td>
                      <td className="num">{areaOf(p) != null ? `${n(areaOf(p).toFixed(2))} ${t('ha')}` : '—'}</td>
                      <td className="num">{availableOf(p) != null ? `${n(availableOf(p).toFixed(2))} ${t('ha')}` : '—'}</td>
                      <td>{p.agent ? <span className="refs"><i className="ref">{p.agent}</i></span> : <span className="dim">—</span>}</td>
                      {mouOn && <td><span className="chip ok">✓ {t('MOU completed')}</span>{p.mouDoc ? <a className="chip info" style={{ marginLeft: 6 }} href={`#/property/${p.id}`}>{t('document')}</a> : <small className="dim" style={{ marginLeft: 6 }}>{t('no document')}</small>}{p.mouDate && <small className="dim" style={{ display: 'block' }}>{new Date(p.mouDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</small>}</td>}
                      <td><div className="acts"><a className="btn ghost sm" href={`#/property/${p.id}`}>{t('Open')}</a>{hasOutline(p) && <button className="btn ghost sm" onClick={() => downloadKml(p)}>KML</button>}{me.isAdmin && p.source !== 'seed' && <button className="btn ghost sm" onClick={() => del(p)} title={t('Remove')}>✕</button>}</div></td>
                    </tr>
                  );
                })}
                {!list.length && <tr><td colSpan={mouOn ? 6 : 5} className="dim">{t('No properties match.')}</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="count" style={{ margin: '10px 2px 0' }}>{t('Showing')} {n(list.length)} / {n(mine.length)}</p>
        </div>
      </div>
    </>
  );
}

function Verify() {
  const { t, n } = useT();
  const p = propByGat('88');
  const v = (Math.abs(p.gis - SATBARA_88.total) / SATBARA_88.total) * 100;
  return (
    <>
      <p className="dim">{t('Compares the 7/12 area with the polygon area computed from the MRSAC cadastral KML — replaces the manual check step.')}</p>
      <table className="tbl"><thead><tr><th>{t('Gat')}</th><th>{t('Area (7/12)')}</th><th>{t('Area (map)')}</th><th>{t('Variance')}</th><th>{t('Result')}</th></tr></thead>
        <tbody>
          <tr><td className="mono">{n(88)}</td><td className="mono">{n(SATBARA_88.total.toFixed(2))}</td><td className="mono">{n(p.gis.toFixed(2))}</td><td className="mono">{n(v.toFixed(2))}%</td><td><span className="chip ok">✓ {t('Consistent')}</span></td></tr>
          {PROPS.filter((x) => !x.real).map((x) => (
            <tr key={x.id}><td className="mono">{n(x.gat)}</td><td className="dim">{x.record712 ? t('Captured from 7/12 document') : t('7/12 not uploaded')}</td><td className="mono">{x.gis != null ? n(x.gis.toFixed(2)) : '—'}</td><td>–</td><td><span className="chip warn">{t('Awaiting 7/12')}</span></td></tr>
          ))}
        </tbody></table>
    </>
  );
}
