import { merc } from './data';
import { useT } from './i18n';

export const Stars = ({ v }) => (
  <span className="stars" aria-label={`${v} / 5`}>{'★'.repeat(Math.round(v))}<i>{'★'.repeat(5 - Math.round(v))}</i></span>
);

export function StatusChip({ s }) {
  const { t } = useT();
  const cls = s === 'Available' ? 'ok' : s === 'Sold' ? 'bad' : 'warn';
  return <span className={`chip ${cls}`}>{t(s)}</span>;
}

export function visitChip(status, t) {
  const cls = { requested: 'warn', confirmed: 'info', completed: 'ok', cancelled: 'bad', no_show: 'bad' }[status];
  return <span className={`chip ${cls}`}>{t(status)}</span>;
}

export function propTitle(p, t, n) {
  return `${t(p.village || 'Site')} · ${t('Gat')} ${n(p.gat)}`;
}

export const priceText = (p, t, n) => (p.price == null ? t('Price on request') : `₹ ${n(p.price.toFixed(1))} ${t('lakh')}`);

/** Real satellite crop of the parcel (Esri export) with its surveyed outline drawn on top. */
export function Thumb({ parcel, w = 640, h = 400 }) {
  if (!parcel) return <div className="thumb empty" aria-hidden="true"><span>—</span></div>;
  // Pin only (no outline known): a satellite crop around the point with a marker.
  const ring = parcel.p && parcel.p.length ? parcel.p[0].map(([la, lo]) => merc(la, lo)) : (() => { const [x, y] = merc(parcel.c[0], parcel.c[1]); return [[x - 60, y - 40], [x + 60, y + 40]]; })();
  const pinOnly = !(parcel.p && parcel.p.length);
  const xs = ring.map((q) => q[0]), ys = ring.map((q) => q[1]);
  const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
  const cx = (minx + maxx) / 2, cy = (miny + maxy) / 2;
  const spanX = Math.max((maxx - minx) * 1.55, (maxy - miny) * 1.55 * (w / h), 280);
  const spanY = spanX * (h / w);
  const x0 = cx - spanX / 2, y1 = cy + spanY / 2;
  const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${x0},${cy - spanY / 2},${cx + spanX / 2},${y1}&bboxSR=3857&imageSR=3857&size=${w},${h}&format=jpg&f=image`;
  const pts = ring.map(([X, Y]) => `${(((X - x0) / spanX) * w).toFixed(1)},${(((y1 - Y) / spanY) * h).toFixed(1)}`).join(' ');
  return (
    <div className="thumb" style={{ backgroundImage: `url(${url})` }}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        {pinOnly
          ? <circle cx={w / 2} cy={h / 2} r="9" fill="#e5483a" stroke="#fff" strokeWidth="3" />
          : <polygon points={pts} fill="rgba(47,191,133,.22)" stroke="#7cf0b5" strokeWidth="4" strokeLinejoin="round" />}
      </svg>
    </div>
  );
}

export function Section({ no, title, children, aside }) {
  return (
    <section className="sec">
      <header className="sec-h"><span className="sec-no">§ {no}</span><h2>{title}</h2><span className="rule" />{aside}</header>
      {children}
    </section>
  );
}
