import { useState } from 'react';
import { propFileName } from './data';
import { actions, useStore } from './store';
import { FEATURES } from './features';
import { useT } from './i18n';
import { CONFIG, LANGS, SOURCES, STATUS_FLOW, VISIT_TYPES, fmtDate, fmtTime, icsFor, isClosed, messageFor, nextDays, nextRef, normPhone, slotsFor, validateBooking } from './booking';

export const mapsUrlOf = (p) => (p.parcel ? `https://www.google.com/maps/search/?api=1&query=${p.parcel.c[0]},${p.parcel.c[1]}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.village} ${p.taluka} ${p.district} Maharashtra`)}`);
export const titleOf = (p) => `${p.village} · Gat ${p.gat}`;
const whereOf = (p) => [p.village, p.taluka, p.district, 'Maharashtra'].filter(Boolean).join(', ');

export function BookingChip({ status }) {
  const { t } = useT();
  const cls = { requested: 'warn', confirmed: 'info', completed: 'ok', cancelled: 'bad', no_show: 'bad' }[status];
  return <span className={`chip ${cls}`}>{t({ requested: 'Requested', confirmed: 'Confirmed', completed: 'Completed', cancelled: 'Cancelled', no_show: 'No-show' }[status])}</span>;
}

/** Confirm / reschedule / complete / no-show / cancel, shown only when the status allows it. */
export function BookingActions({ b, p }) {
  const s = useStore();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const days = nextDays(15).filter((d) => !isClosed(d));
  const [d, setD] = useState(days[0]);
  const [tm, setTm] = useState('');
  const next = STATUS_FLOW[b.status] || [];
  const bookings = s.bookings || [];
  const free = slotsFor(d, b.propId, b.type, bookings, b.id).filter((x) => x.state === 'free');
  const act = (st) => { if (st === 'cancelled' && !window.confirm(t('Cancel this visit?'))) return; actions.bookingStatus(b.id, st); };
  if (!next.length) return <span className="dim small">—</span>;
  return (
    <div className="bact">
      <div className="acts">
        {next.includes('confirmed') && <button className="btn sm" onClick={() => act('confirmed')}>{t('Confirm')}</button>}
        {b.status === 'confirmed' && <button className="btn ghost sm" onClick={() => setOpen(!open)}>{t('Reschedule')}</button>}
        {next.includes('completed') && <button className="btn sm" onClick={() => act('completed')}>{t('Complete')}</button>}
        {next.includes('no_show') && <button className="btn ghost sm" onClick={() => act('no_show')}>{t('No-show')}</button>}
        {next.includes('cancelled') && <button className="btn ghost sm" onClick={() => act('cancelled')}>{t('Cancel')}</button>}
      </div>
      {open && (
        <div className="resched">
          <select value={d} onChange={(e) => { setD(e.target.value); setTm(''); }}>{days.map((x) => <option key={x} value={x}>{fmtDate(x)}</option>)}</select>
          <select value={tm} onChange={(e) => setTm(e.target.value)}><option value="">{t('Time')}</option>{free.map((x) => <option key={x.time} value={x.time}>{fmtTime(x.time)}</option>)}</select>
          <button className="btn sm" disabled={!tm} onClick={() => { actions.rescheduleBooking(b.id, d, tm, free.find((x) => x.time === tm).rep); setOpen(false); }}>{t('Save')}</button>
        </div>
      )}
      {p && null}
    </div>
  );
}

const EMPTY = { type: 'site', date: '', time: '', name: '', phone: '', email: '', visitors: '2', language: LANGS[0], source: SOURCES[0], pickup: false, pickupPoint: '', notes: '', confirmNow: false, consent: false };

export default function BookingSection({ p }) {
  const s = useStore();
  const { t } = useT();
  const bookings = s.bookings || [];
  const [v, setV] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [done, setDone] = useState(null);
  const days = nextDays(14);
  const slots = slotsFor(v.date, p.id, v.type, bookings);
  const mine = bookings.filter((b) => b.propId === p.id).sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
  const set = (k) => (e) => { const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value; setV((f) => ({ ...f, [k]: val })); };
  const stateLabel = { taken: 'Booked', full: 'No staff', past: 'Too soon', closed: 'Closed' };

  const submit = (e) => {
    e.preventDefault();
    const { errors: errs, clean } = validateBooking(v, bookings, p.id);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const now = new Date();
    const b = {
      id: `B${Date.now()}`, ref: nextRef(bookings, now), propId: p.id, type: clean.type, date: clean.date, time: clean.time, rep: clean.rep, name: clean.name, phone: clean.phone, email: clean.email,
      visitors: clean.visitors, language: clean.language, source: clean.source, pickup: clean.pickup, pickupPoint: clean.pickup ? clean.pickupPoint.trim() : '', notes: clean.notes.trim(),
      status: clean.confirmNow ? 'confirmed' : 'requested', createdAt: now.toISOString(), consent: { at: now.toISOString(), version: CONFIG.consentVersion },
      history: [{ at: now.toISOString(), status: clean.confirmNow ? 'confirmed' : 'requested', note: `Created via ${clean.source}` }],
    };
    actions.addBooking(b);
    setDone(b);
    setV(EMPTY);
  };

  const copy = async (text) => { try { await navigator.clipboard.writeText(text); actions.notify('Message copied'); } catch (e) { actions.notify('Could not copy'); } };
  const downloadIcs = (b) => {
    const blob = new Blob([icsFor(b, titleOf(p), whereOf(p), mapsUrlOf(p))], { type: 'text/calendar;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = propFileName(p, 'ics'); a.click();
  };

  const sold = p.status === 'Sold';
  const Err = ({ k }) => (errors[k] ? <small className="ferr">{t(errors[k])}</small> : null);

  return (
    <div className="bk">
      {done && (
        <div className="bkdone">
          <div className="row between wrap"><div><p className="kicker">{t('Visit saved')}</p><h3 style={{ margin: 0 }}>{done.ref} · {fmtDate(done.date)}, {fmtTime(done.time)}</h3></div><BookingChip status={done.status} /></div>
          <p className="dim small">{done.name} · +91 {done.phone} · {done.type === 'video' ? t('Video walkthrough') : t('At the site')} · {done.visitors} {t('visitors')} · {done.rep}</p>
          <p className="small">{FEATURES.whatsapp ? t('Nothing is sent automatically. Send the visitor their details with one click:') : t('Nothing is sent automatically. Copy the details for the visitor, or add the visit to a calendar:')}</p>
          <div className="row wrap">
            {FEATURES.whatsapp && <a className="btn wa sm" target="_blank" rel="noopener noreferrer" href={`https://wa.me/91${normPhone(done.phone)}?text=${encodeURIComponent(messageFor(done, titleOf(p), mapsUrlOf(p)))}`}>{t('WhatsApp the visitor')}</a>}
            <button className="btn ghost sm" onClick={() => copy(messageFor(done, titleOf(p), mapsUrlOf(p)))}>{t('Copy message')}</button>
            <button className="btn ghost sm" onClick={() => downloadIcs(done)}>{t('Add to calendar (.ics)')}</button>
            <button className="btn ghost sm" onClick={() => setDone(null)}>{t('Book another')}</button>
          </div>
        </div>
      )}

      {sold ? <p className="chip bad">{t('This property is sold — new visits are switched off.')}</p> : (
        <form onSubmit={submit} noValidate className="bkform">
          <div className="bkcol">
            <h3>1 · {t('Visit type')}</h3>
            <div className="seg">{VISIT_TYPES.map(([k, l]) => <button type="button" key={k} className={v.type === k ? 'on' : ''} onClick={() => setV((f) => ({ ...f, type: k, time: '' }))}>{t(l)}</button>)}</div>
            <h3>2 · {t('Choose a date and time')}</h3>
            <div className="dstrip">
              {days.map((d) => {
                const dt = new Date(`${d}T12:00:00`);
                return (
                  <button type="button" key={d} disabled={isClosed(d)} className={`dchip ${v.date === d ? 'on' : ''}`} onClick={() => setV((f) => ({ ...f, date: d, time: '' }))}>
                    <small>{dt.toLocaleDateString('en-IN', { weekday: 'short' })}</small><b>{dt.getDate()}</b><small>{dt.toLocaleDateString('en-IN', { month: 'short' })}</small>
                  </button>
                );
              })}
            </div>
            <Err k="date" />
            {v.date && (
              <div className="slots">
                {slots.map((x) => (
                  <button type="button" key={x.time} disabled={x.state !== 'free'} className={`schip ${x.state} ${v.time === x.time ? 'on' : ''}`} onClick={() => setV((f) => ({ ...f, time: x.time }))}>
                    {fmtTime(x.time)}{x.state !== 'free' && <small>{t(stateLabel[x.state])}</small>}
                  </button>
                ))}
              </div>
            )}
            <Err k="time" />
            <p className="small dim">{t('Visits last about an hour. Open every day; the last visit ends at 7 PM. The earliest booking is 2 hours from now.')}</p>
          </div>

          <div className="bkcol">
            <h3>3 · {t('Visitor details')}</h3>
            <div className="bkfields">
              <label className="wf"><span>{t('Name')} *</span><input value={v.name} onChange={set('name')} autoComplete="off" /><Err k="name" /></label>
              <label className="wf"><span>{t('Mobile')} *</span><input value={v.phone} onChange={set('phone')} inputMode="tel" placeholder="98765 43210" /><Err k="phone" /></label>
              <label className="wf"><span>{t('Email')}</span><input value={v.email} onChange={set('email')} inputMode="email" /><Err k="email" /></label>
              <label className="wf"><span>{t('Visitors')}</span><input value={v.visitors} onChange={set('visitors')} inputMode="numeric" /><Err k="visitors" /></label>
              <label className="wf"><span>{t('Language')}</span><select value={v.language} onChange={set('language')}>{LANGS.map((l) => <option key={l}>{l}</option>)}</select></label>
              <label className="wf"><span>{t('How did they contact us?')}</span><select value={v.source} onChange={set('source')}>{SOURCES.map((l) => <option key={l}>{l}</option>)}</select></label>
            </div>
            {v.type === 'site' && (
              <>
                <label className="chk"><input type="checkbox" checked={v.pickup} onChange={set('pickup')} /> {t('Needs pickup / transport to the site')}</label>
                {v.pickup && <label className="wf"><span>{t('Pickup point')}</span><input value={v.pickupPoint} onChange={set('pickupPoint')} placeholder="Panvel station" /><Err k="pickupPoint" /></label>}
              </>
            )}
            <label className="wf"><span>{t('Notes or questions')}</span><textarea rows="2" value={v.notes} onChange={set('notes')} maxLength={500} /></label>
            <label className="chk"><input type="checkbox" checked={v.confirmNow} onChange={set('confirmNow')} /> {t('Visitor has already agreed — confirm now')}</label>
            <label className="chk consent"><input type="checkbox" checked={v.consent} onChange={set('consent')} />
              <span>{t('The visitor agrees that AB Developers may contact them on these details about this site visit. Their name and phone are used only to arrange and confirm the visit, and they can ask to withdraw consent or delete their details at any time.')}</span></label>
            <Err k="consent" />
            <button className="btn">{v.confirmNow ? t('Book and confirm') : t('Save visit request')}</button>
          </div>
        </form>
      )}

      <h3>{t('Visits for this property')}</h3>
      {mine.length ? (
        <div className="reg"><table className="bklist">
          <thead><tr><th>{t('Ref')}</th><th>{t('When')}</th><th>{t('Visitor')}</th><th>{t('Type')}</th><th>{t('Staff')}</th><th>{t('Status')}</th><th /></tr></thead>
          <tbody>{mine.map((b) => (
            <tr key={b.id}><td className="code">{b.ref}</td><td>{fmtDate(b.date)}<br /><span className="dim small">{fmtTime(b.time)}</span></td>
              <td>{b.name}<br /><span className="dim small">+91 {b.phone} · {b.visitors}</span></td><td>{b.type === 'video' ? t('Video') : t('Site')}</td><td>{b.rep}</td><td><BookingChip status={b.status} /></td>
              <td><BookingActions b={b} p={p} /></td></tr>
          ))}</tbody></table></div>
      ) : <p className="dim">{t('No visits booked for this property yet.')}</p>}
    </div>
  );
}
