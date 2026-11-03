import { useState } from 'react';
import { PROPS, propById } from './data';
import { useStore } from './store';
import { useT } from './i18n';
import { BookingActions, BookingChip, titleOf } from './BookingSection';
import { fmtDate, fmtTime, isActive, nextDays, ymd } from './booking';

/** All site-visit bookings across properties: the team's day-to-day list. */
export default function Visits() {
  const s = useStore();
  const { t, n } = useT();
  const [tab, setTab] = useState('upcoming');
  const all = (s.bookings || []).slice().sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  const today = ymd(new Date());
  const week = nextDays(7);
  const TABS = {
    upcoming: ['Upcoming', (b) => isActive(b) && b.date >= today],
    today: ['Today', (b) => b.date === today && isActive(b)],
    requested: ['Needs confirmation', (b) => b.status === 'requested'],
    done: ['Done', (b) => ['completed', 'no_show', 'cancelled'].includes(b.status)],
    all: ['All', () => true],
  };
  const count = (k) => all.filter(TABS[k][1]).length;
  const list = all.filter(TABS[tab][1]);

  return (
    <>
      <div className="stats">
        <div className="stat"><b>{n(all.filter((b) => b.date === today && isActive(b)).length)}</b><span>{t('Today')}</span></div>
        <div className="stat"><b>{n(all.filter((b) => b.status === 'requested').length)}</b><span>{t('Needs confirmation')}</span></div>
        <div className="stat"><b>{n(all.filter((b) => isActive(b) && week.includes(b.date)).length)}</b><span>{t('Next 7 days')}</span></div>
      </div>
      <div className="stabs vtabs" role="tablist">
        {Object.entries(TABS).map(([k, [label]]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={`stab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{t(label)}<b>{n(count(k))}</b></button>
        ))}
      </div>
      <div className="reg" style={{ marginTop: 12 }}>
        <table className="bklist">
          <thead><tr><th>{t('Ref')}</th><th>{t('When')}</th><th>{t('Property')}</th><th>{t('Visitor')}</th><th>{t('Type')}</th><th>{t('Staff')}</th><th>{t('Status')}</th><th /></tr></thead>
          <tbody>
            {list.map((b) => {
              const p = propById(b.propId);
              return (
                <tr key={b.id}>
                  <td className="code">{b.ref}</td>
                  <td>{fmtDate(b.date)}<br /><span className="dim small">{fmtTime(b.time)}</span></td>
                  <td>{p ? <a href={`#/property/${p.id}`}>{titleOf(p)}</a> : b.propId}</td>
                  <td>{b.name}<br /><span className="dim small">+91 {b.phone} · {b.visitors} · {b.source}</span></td>
                  <td>{b.type === 'video' ? t('Video') : t('Site')}</td><td>{b.rep}</td>
                  <td><BookingChip status={b.status} /></td>
                  <td><BookingActions b={b} p={p} /></td>
                </tr>
              );
            })}
            {!list.length && <tr><td colSpan="8" className="dim">{t('No visits here.')} {PROPS.length ? <a href="#/admin/props">{t('Open a property to book one.')}</a> : null}</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
