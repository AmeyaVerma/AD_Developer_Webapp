// Site-visit booking rules: slots, availability, validation, calendar file and message text.

export const CONFIG = {
  slots: ['10:00', '11:30', '15:00', '16:30', '18:00'], // one-hour visits; the last one ends at 7 PM
  durationMin: 60,
  daysAhead: 30,           // how far ahead a visit can be booked
  leadHours: 2,            // earliest bookable time from now
  closedWeekdays: [],      // open every day (use 0 for Sunday, 1 for Monday, … to close a weekday)
  reps: ['Site team A', 'Site team B'], // staff who can run visits at the same time
  maxVisitors: 10,
  consentVersion: 'v1',
};
export const VISIT_TYPES = [['site', 'At the site'], ['video', 'Video walkthrough']];
export const SOURCES = ['Phone call', 'WhatsApp', 'Walk-in', 'Referral', 'Website'];
export const LANGS = ['English', 'मराठी', 'हिन्दी'];
export const STATUS_FLOW = { requested: ['confirmed', 'cancelled'], confirmed: ['completed', 'no_show', 'cancelled'], completed: [], no_show: [], cancelled: [] };

const ACTIVE = ['requested', 'confirmed'];
export const isActive = (b) => ACTIVE.includes(b.status);
const pad = (x) => String(x).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const slotDate = (date, time) => new Date(`${date}T${time}:00+05:30`); // visits are in India time
export const isClosed = (date) => CONFIG.closedWeekdays.includes(new Date(`${date}T12:00:00`).getDay());
export const nextDays = (count, from = new Date()) => Array.from({ length: count }, (_, i) => { const d = new Date(from); d.setDate(d.getDate() + i); return ymd(d); });
export const fmtDate = (date) => new Date(`${date}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
export const fmtTime = (time) => { const [h, m] = time.split(':').map(Number); return `${h % 12 || 12}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`; };

/** State of every slot on a date. A site visit needs the property AND a free staff member; a video call needs only staff. */
export function slotsFor(date, propId, type, bookings, ignoreId = null, now = new Date()) {
  return CONFIG.slots.map((time) => {
    if (!date || isClosed(date)) return { time, state: 'closed' };
    if (slotDate(date, time) - now < CONFIG.leadHours * 3600000) return { time, state: 'past' };
    const active = bookings.filter((b) => isActive(b) && b.date === date && b.time === time && b.id !== ignoreId);
    if (type === 'site' && active.some((b) => b.propId === propId && b.type === 'site')) return { time, state: 'taken' };
    const busy = new Set(active.map((b) => b.rep));
    const rep = CONFIG.reps.find((r) => !busy.has(r));
    return rep ? { time, state: 'free', rep } : { time, state: 'full' };
  });
}

/** Digits of an Indian mobile number. A +91 / 91 / 0 prefix is removed only when what remains is a full 10-digit number. */
export const normPhone = (s) => {
  let d = String(s || '').replace(/[\s\-()]/g, '');
  if (/^\+91\d{10}$/.test(d)) d = d.slice(3);
  else if (/^91\d{10}$/.test(d)) d = d.slice(2);
  else if (/^0\d{10}$/.test(d)) d = d.slice(1);
  return d;
};
export const nextRef = (bookings, now = new Date()) => {
  const seq = bookings.reduce((m, b) => Math.max(m, Number(String(b.ref || '').split('-')[2]) || 0), 0) + 1;
  return `SV-${now.getFullYear()}-${String(seq).padStart(4, '0')}`;
};

export function validateBooking(v, bookings, propId, now = new Date()) {
  const e = {};
  const name = String(v.name || '').trim();
  if (name.length < 2) e.name = 'Enter the visitor name';
  const phone = normPhone(v.phone);
  if (!/^[6-9]\d{9}$/.test(phone)) e.phone = 'Enter a 10-digit Indian mobile number (starts with 6–9)';
  const email = String(v.email || '').trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Email looks incorrect';
  const people = Number(v.visitors);
  if (!Number.isInteger(people) || people < 1 || people > CONFIG.maxVisitors) e.visitors = `Between 1 and ${CONFIG.maxVisitors} visitors`;
  if (v.pickup && !String(v.pickupPoint || '').trim()) e.pickupPoint = 'Where should we pick them up?';
  if (String(v.notes || '').length > 500) e.notes = 'Keep notes under 500 characters';
  if (!v.consent) e.consent = 'Consent is needed to contact the visitor about this visit';
  if (!v.date) e.date = 'Choose a date';
  else if (!nextDays(CONFIG.daysAhead + 1, now).includes(v.date)) e.date = `Choose a date within the next ${CONFIG.daysAhead} days`;
  let rep = null;
  if (v.date && !e.date) {
    if (!v.time) e.time = 'Choose a time';
    else {
      const slot = slotsFor(v.date, propId, v.type, bookings, null, now).find((s) => s.time === v.time);
      if (!slot || slot.state !== 'free') e.time = 'That time is no longer available — pick another';
      else rep = slot.rep;
    }
  }
  if (!e.phone && !e.date && bookings.some((b) => isActive(b) && b.propId === propId && b.date === v.date && normPhone(b.phone) === phone)) e.phone = 'This number already has a visit to this property on that day';
  return { errors: e, clean: { ...v, name, phone, email, visitors: people, rep } };
}

const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const stamp = (d) => d.toISOString().replace(/[-:]|\.\d{3}/g, '');

/** .ics calendar file so the visit can be added to any calendar app. */
export function icsFor(b, title, where, mapsUrl) {
  const start = slotDate(b.date, b.time), end = new Date(start.getTime() + CONFIG.durationMin * 60000);
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//AB Developers//Site visit//EN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${b.ref}@ab-developers`, `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(`Site visit – ${title}`)}`, `LOCATION:${esc(where)}`,
    `DESCRIPTION:${esc(`Reference ${b.ref}. ${b.type === 'video' ? 'Video walkthrough.' : 'Please carry a photo ID.'} Map: ${mapsUrl}`)}`,
    'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', 'DESCRIPTION:Site visit reminder', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
}

export function messageFor(b, title, mapsUrl) {
  const status = b.status === 'requested' ? 'received' : 'confirmed';
  return [`Hello ${b.name},`, `Your ${b.type === 'video' ? 'video walkthrough' : 'site visit'} for ${title} is ${status}.`,
    `When: ${fmtDate(b.date)}, ${fmtTime(b.time)}`, b.type === 'site' ? `Meeting point: ${mapsUrl}` : 'We will call you on this number at the time.',
    b.pickup ? `Pickup: ${b.pickupPoint}` : '', b.type === 'site' ? 'Please carry a photo ID.' : '', `Reference: ${b.ref}`, 'To reschedule or cancel, reply to this message. — AB Developers'].filter(Boolean).join('\n');
}
