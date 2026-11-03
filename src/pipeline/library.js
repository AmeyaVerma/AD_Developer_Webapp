// Village map library: plot boundaries per village, keyed by the village code printed on the 7/12.
// Built in: Nanoshi (from the client's MRSAC KML). More villages can be added by uploading their KML.
import PARCELS from '../parcels.json';

const KEY = 'ab_village_maps_v1';
const area = (rings) => {
  const ky = 110574, kx = 111320 * Math.cos(18.9 * Math.PI / 180);
  return rings.reduce((s, r) => {
    let a = 0;
    for (let k = 0; k < r.length - 1; k++) a += r[k][1] * kx * r[k + 1][0] * ky - r[k + 1][1] * kx * r[k][0] * ky;
    return s + Math.abs(a / 2);
  }, 0) / 10000;
};

const BUILTIN = {
  553456: { code: '553456', village: 'Nanoshi', taluka: 'Panvel', district: 'Raigad', source: 'Client KML (MRSAC cadastral)', parcels: PARCELS.map((p) => ({ gat: p.pin, ha: p.ha, c: p.c, p: p.p })) },
};

function readUploaded() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
}
export const library = () => ({ ...BUILTIN, ...readUploaded() });

/** Parse a village KML (MRSAC style: placemarks with PIN = gat number and LGD_CODE = village code). */
export function parseKml(xml, filename = 'uploaded.kml') {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const parcels = [];
  let code = '', village = '', taluka = '', district = '';
  doc.querySelectorAll('Placemark').forEach((pm) => {
    const d = {};
    pm.querySelectorAll('SimpleData').forEach((s) => { d[s.getAttribute('name')] = s.textContent; });
    const coords = [...pm.querySelectorAll('outerBoundaryIs coordinates')];
    if (!d.PIN || !coords.length) return;
    code = code || d.LGD_CODE || d.VINCODE || '';
    village = village || d.VIL_NAME || ''; taluka = taluka || d.THName || ''; district = district || d.DTName || '';
    const rings = coords.map((c) => c.textContent.trim().split(/\s+/).map((t) => { const [x, y] = t.split(',').map(Number); return [y, x]; }));
    const all = rings.flat();
    parcels.push({ gat: String(d.PIN), ha: +area(rings).toFixed(3), c: [all.reduce((s, q) => s + q[0], 0) / all.length, all.reduce((s, q) => s + q[1], 0) / all.length], p: rings });
  });
  if (!parcels.length || !code) throw new Error('This KML has no plots with a gat number (PIN) and village code (LGD_CODE).');
  const entry = { code, village, taluka, district, source: filename, parcels };
  const store = readUploaded();
  store[code] = entry;
  try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { throw new Error('Browser storage is full; this KML is too large to keep.'); }
  return entry;
}

/** Find the plot for a village code + gat number (sub-division "88/1" falls back to "88"). */
export function findParcel(code, gat) {
  const v = library()[String(code)];
  if (!v || !gat) return null;
  const base = String(gat).split('/')[0];
  const matches = v.parcels.filter((p) => p.gat === gat || p.gat === base).sort((a, b) => a.ha - b.ha);
  return matches.length ? { village: v, parcel: matches[0] } : null;
}

/** Fallback when no plot boundary exists: approximate village centre from OpenStreetMap (Nominatim). */
export async function geocodeVillage(queries) {
  for (const q of queries.filter(Boolean)) {
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(q)}`, { headers: { Accept: 'application/json' } });
      const j = await r.json();
      if (j[0]) return { center: [Number(j[0].lat), Number(j[0].lon)], label: j[0].display_name };
    } catch (e) { /* try next */ }
  }
  return null;
}
