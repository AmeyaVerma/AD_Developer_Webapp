import { useSyncExternalStore } from 'react';

const KEY = 'dev_demo_v5';
export const TODAY = '2026-10-28';

function seed() {
  return {
    lang: 'en',
    attnDismissed: false,
    // Site visit reports, recorded by the Developers team.
    reports: [
      { id: 'R1', gat: '88', author: 'Sneha Kulkarni', kind: 'buyer', overall: 4, loc: 5, cond: 4, val: 4, feeling: 'positive', date: '2026-10-12',
        body: 'Easy to reach from the Panvel side. The land is level and the boundary stones were visible. Felt like a genuinely good option for a farmhouse.' },
      { id: 'R2', gat: '88', author: 'Site team', kind: 'team', overall: 4, loc: 5, cond: 4, val: 4, feeling: 'positive', date: '2026-10-05',
        body: 'Boundary marking matches the cadastral KML, no encroachment observed. Some shrub clearing needed along the north edge.' },
      { id: 'R3', gat: '88', author: 'Amit Patil', kind: 'buyer', overall: 3, loc: 4, cond: 3, val: 3, feeling: 'neutral', date: '2026-10-22',
        body: 'The last stretch of road was muddy after rain. Land itself is fine; would want access improved before buying.' },
    ],
  };
}

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.reports) return { ...s, toast: null, videos: {} };
  } catch (e) { /* ignore */ }
  return { ...seed(), toast: null, videos: {} };
}

let state = load();
const subs = new Set();

function emit() {
  try {
    const { toast, videos, ...persist } = state; // eslint-disable-line no-unused-vars
    localStorage.setItem(KEY, JSON.stringify(persist));
  } catch (e) { /* ignore */ }
  subs.forEach((f) => f());
}
function update(fn) { state = fn(state); emit(); }

export const useStore = () =>
  useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, () => state);

const toast = (msg) => update((s) => ({ ...s, toast: { msg, id: Date.now() } }));

export const actions = {
  setLang: (lang) => update((s) => ({ ...s, lang })),
  clearToast: () => update((s) => ({ ...s, toast: null })),
  dismissAttention: () => update((s) => ({ ...s, attnDismissed: true })),
  touch: () => update((s) => ({ ...s, rev: (s.rev || 0) + 1 })), // re-render lists after PROPS changes
  addBooking: (b) => { update((s) => ({ ...s, bookings: [...(s.bookings || []), b] })); toast(b.status === 'confirmed' ? 'Visit booked and confirmed' : 'Visit request saved'); },
  bookingStatus: (id, status, note = '') => {
    update((s) => ({ ...s, bookings: (s.bookings || []).map((b) => (b.id === id ? { ...b, status, history: [...(b.history || []), { at: new Date().toISOString(), status, note }] } : b)) }));
    toast({ confirmed: 'Visit confirmed', completed: 'Visit marked completed', no_show: 'Visit marked no-show', cancelled: 'Visit cancelled' }[status] || 'Visit updated');
  },
  rescheduleBooking: (id, date, time, rep) => {
    update((s) => ({ ...s, bookings: (s.bookings || []).map((b) => (b.id === id ? { ...b, date, time, rep, history: [...(b.history || []), { at: new Date().toISOString(), status: b.status, note: `Rescheduled to ${date} ${time}` }] } : b)) }));
    toast('Visit rescheduled');
  },
  notify: (msg) => toast(msg),
  reset: () => { const keep = state.lang; state = { ...seed(), lang: keep, toast: null, videos: {} }; toast('Demo data reset'); },
  addReport: (r) => {
    update((s) => ({ ...s, reports: [...s.reports, { ...r, id: 'R' + String(Date.now() % 1000000), date: TODAY }] }));
    toast('Report added');
  },
  removeReport: (id) => {
    update((s) => ({ ...s, reports: s.reports.filter((r) => r.id !== id) }));
    toast('Report removed');
  },
  attachVideo: (gat, url) => {
    update((s) => ({ ...s, videos: { ...s.videos, [gat]: url } }));
    toast('Video attached (demo preview; production uses a streaming provider)');
  },
};
