import PARCELS from './parcels.json';

// Parcels come from the client's "nanoshi 2026.kml": { pin, ha, c:[lat,lng], p:[ring[[lat,lng]...]...] }
export const parcels = PARCELS;

// Gat 88: transcribed from the client's Satbara PDF (7/12 + form 12).
export const SATBARA_88 = {
  village: 'नानोशी (५५३४५६)', taluka: 'पनवेल', district: 'रायगड', gat: '८८', puid: '18037120268',
  localName: 'दिवटीचा माळ', tenure: 'भोगवटादार वर्ग -१',
  cultivable: 2.13, potKharab: 0.2, total: 2.33, assessment: 4.75,
  owners: ['अजय महादेव जाधव', 'संजय महादेव जाधव'], khata: '२२३',
  lastMutation: '८४८ (१०/११/२०२४)', pending: 'नाही',
  otherRights: 'पंडया आणि कं सॉलिसिटर्स (२१); वि.दा.घेणार (२१)',
  history: ['छाया राजाराम पाटील (खाते १४६, १७०)', 'कलेक्टर व डेप्युटी कस्टोडियन इव्हॅक्यु प्रॉपर्टी (खाते १५४)', 'सतीश बाळासो पाटील (खाते २००)'],
  crop: '२०२३-२४ खरीप – गवत पड (२.३३.००)', downloaded: '29-08-2026', verifyId: '2402100001290321',
};

const SAMPLE = [
  ['97', 'Available', 'Agricultural land', 18.5],
  ['95', 'Under offer', 'Agricultural land', 16.2],
  ['94', 'Available', 'Agricultural land', 12.8],
  ['5', 'Available', 'Residential plot (NA)', 21.0],
  ['93', 'Sold', 'Agricultural land', 10.4],
  ['6', 'Available', 'Agricultural land', 12.1],
  ['2', 'Under offer', 'Residential plot (NA)', 6.5],
];

export const parcelByPin = (pin) =>
  parcels.filter((x) => x.pin === pin).sort((a, b) => a.ha - b.ha)[0];

const SEED_AGENT = { 88: 'A', 97: 'B', 95: 'P', 94: 'J', 5: 'P', 93: 'A', 6: 'J', 2: 'B' };
const SEED_SOLD = { 93: 0.3, 95: 0.15 };
const SEED_MOU = { 88: '2026-10-12', 95: '2026-10-20' }; // demo: two properties with the MOU done
const SEED_AUTH = { 88: 'NAINA', 97: 'TPS', 95: 'MSRDC', 94: 'MMRDA', 5: 'PMC', 93: 'NAINA', 6: 'Other', 2: 'TPS' };
function build() {
  const base = { state: 'Maharashtra', taluka: 'Panvel', district: 'Raigad', village: 'Nanoshi', villageCode: '553456', source: 'seed' };
  const p88 = parcelByPin('88');
  const out = [{
    ...base, id: '88', gat: '88', planningAuthority: SEED_AUTH[88], mou: !!SEED_MOU[88], mouDate: SEED_MOU[88] || '', mouSeed: !!SEED_MOU[88], agent: SEED_AGENT[88], soldHa: 0, real: true, status: 'Available', type: 'Agricultural land', price: null,
    ha712: SATBARA_88.total, gis: p88.ha, parcel: p88,
    desc: 'Level agricultural land of about 2.33 ha (5.8 acres) at Nanoshi, Panvel. Clean 7/12 with no pending mutation. Parcel boundary verified against the MRSAC cadastral KML.',
    features: ['Bhogwatdar Class-1 tenure', 'No pending mutation', 'Boundary on cadastral KML', 'Near Panvel'],
  }];
  SAMPLE.forEach(([pin, status, type, lakhPerHa]) => {
    const p = parcelByPin(pin);
    if (!p) return;
    out.push({
      ...base, id: pin, gat: pin, planningAuthority: SEED_AUTH[pin] || 'Other', mou: !!SEED_MOU[pin], mouDate: SEED_MOU[pin] || '', mouSeed: !!SEED_MOU[pin], agent: SEED_AGENT[pin] || '', soldHa: SEED_SOLD[pin] || 0, real: false, status, type, price: Math.round(lakhPerHa * p.ha * 10) / 10,
      ha712: null, gis: p.ha, parcel: p,
      desc: 'Sample listing generated from the cadastral KML parcel. Details will come from the 7/12 once uploaded.',
      features: ['Cadastral boundary mapped', '7/12 pending upload'],
    });
  });
  return out;
}
export const PROPS = build();

// Properties added by the user (manual, Excel, 7/12) live in localStorage and are appended to PROPS.
import { SUPABASE_ON, supabase } from './supabase';
const USER_KEY = 'ab_user_props_v1';
if (!SUPABASE_ON) try { const saved = JSON.parse(localStorage.getItem(USER_KEY)); if (Array.isArray(saved)) saved.forEach((p) => PROPS.push(p)); } catch (e) { /* ignore */ }
// Earlier builds allowed several initials per property; keep the first one only.
PROPS.forEach((p) => { if (p.source !== 'seed') { if (!p.agent && p.refs?.length) p.agent = p.refs[0]; delete p.refs; } });
const saveUser = () => {
  if (SUPABASE_ON) return; // the server is the store
  try { localStorage.setItem(USER_KEY, JSON.stringify(PROPS.filter((p) => p.source !== 'seed'))); } catch (e) { throw new Error('Browser storage is full — remove some properties first.'); }
};

/** Area still available = total area (7/12) minus any area marked sold. */
export const availableOf = (p) => { const a = areaOf(p); return a == null ? null : Math.max(0, a - (p.soldHa || 0)); };

export const propById = (id) => PROPS.find((p) => p.id === id);
export const propByGat = propById; // seeded properties use the gat number as their id
export const propKey = (p) => `${p.villageCode || String(p.village || '').trim().toLowerCase()}|${String(p.gat).trim().toLowerCase()}`;
export const findDuplicate = (p) => PROPS.find((x) => propKey(x) === propKey(p));
export function newId(p) {
  const slug = String(p.village || 'site').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'site';
  let id = `${slug}-${String(p.gat).replace(/[^a-z0-9]+/gi, '-')}`;
  let n = 2;
  while (PROPS.some((x) => x.id === id)) id = `${id.replace(/-\d+$/, '')}-${n++}`;
  return id;
}
export function addProps(list) { list.forEach((p) => PROPS.push(p)); saveUser(); }

const rowOf = (p, userId) => ({ id: p.id, agent_code: p.agent || null, approval: p.approval || 'approved', data: p, created_by: userId, verification_id: p.verificationId || null });
const propOf = (r) => ({ ...r.data, id: r.id, agent: r.agent_code || '', approval: r.approval, verificationId: r.verification_id, source: r.data?.source || 'doc712' });

/** Save a new property. With Supabase the server's rules decide: an unverified document or someone else's agent letter is refused. */
export async function saveNewProperty(p) {
  if (!SUPABASE_ON) { addProps([p]); return; }
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase.from('properties').insert(rowOf(p, u?.user?.id));
  if (error) throw new Error(/duplicate|unique/i.test(error.message) ? 'A property with this ID or this 7/12 file already exists.' : 'The server refused to save this property. The 7/12 must be verified first.');
  PROPS.push(p);
}

/** Load the properties this person may see (the server returns only their own rows for an agent). */
export async function hydrateProps() {
  if (!SUPABASE_ON) return;
  const { data, error } = await supabase.from('properties').select('id, agent_code, approval, data, verification_id').order('created_at');
  if (error) return;
  for (let i = PROPS.length - 1; i >= 0; i--) if (PROPS[i].source !== 'seed') PROPS.splice(i, 1);
  data.forEach((r) => PROPS.push(propOf(r)));
}
export function clearUserProps() { for (let i = PROPS.length - 1; i >= 0; i--) if (PROPS[i].source !== 'seed') PROPS.splice(i, 1); }
export async function updateProp(id, patch) {
  const p = PROPS.find((x) => x.id === id);
  if (!p || p.source === 'seed') return;
  if (SUPABASE_ON && patch.approval) {
    const { error } = await supabase.from('properties').update({ approval: patch.approval }).eq('id', id);
    if (error) throw new Error('Could not update the property.');
  }
  Object.assign(p, patch); saveUser();
}

export async function removeProp(id) {
  const i = PROPS.findIndex((p) => p.id === id && p.source !== 'seed');
  if (i < 0) return;
  if (SUPABASE_ON) {
    const { error } = await supabase.from('properties').delete().eq('id', id);
    if (error) throw new Error('Could not remove the property.');
  }
  PROPS.splice(i, 1); saveUser();
}

export function ratingStats(reports, gat) {
  const rs = reports.filter((r) => r.gat === gat);
  if (!rs.length) return null;
  const d = [0, 0, 0, 0, 0];
  rs.forEach((r) => d[r.overall - 1]++);
  return { n: rs.length, avg: rs.reduce((a, r) => a + r.overall, 0) / rs.length, d };
}

export function autoChecks(body) {
  const f = [];
  if (/\d[\d\s-]{8,}\d/.test(body)) f.push('Phone number');
  if (/https?:|www\.|\.com/i.test(body)) f.push('Link');
  if (/\b(fraud|scam|idiot|stupid)\b/i.test(body)) f.push('Abusive words');
  return f;
}

// Web-mercator helpers (used for real satellite thumbnails).
export const merc = (lat, lng) => {
  const R = 6378137;
  return [R * lng * Math.PI / 180, R * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360))];
};

export function parcelFeatureCollection(list, { focus, hot } = {}) {
  return {
    type: 'FeatureCollection',
    features: parcels.filter((x) => x.ha < 50).map((x) => {
      const listed = list.find((p) => p.parcel && p.parcel.c && p.parcel.c[0] === x.c[0] && p.parcel.c[1] === x.c[1]);
      const k = listed ? (listed.id === focus ? 'sel' : listed.id === hot ? 'hot' : 'listed') : 'other';
      return {
        type: 'Feature',
        properties: { gat: x.pin, ha: x.ha, k, listed: !!listed },
        geometry: { type: 'MultiPolygon', coordinates: x.p.map((ring) => [ring.map(([la, lo]) => [lo, la])]) },
      };
    }),
  };
}

/** Best known area in hectares: from the 7/12, else as entered, else from the map outline. */
export const areaOf = (p) => p.ha712 ?? p.haDeclared ?? p.gis ?? null;

export const hasOutline = (p) => !!(p.parcel && p.parcel.p && p.parcel.p.length);

/** File name for any download about a property: "Panvel_Nanoshi_Gat_88.ext" (Taluka - Village, plus gat so two plots never clash). */
export const propFileName = (p, ext) => `${[p.taluka, p.village, `Gat ${p.gat}`].filter(Boolean).join(' ')}.${ext}`.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_');

export function downloadKml(p) {
  if (!hasOutline(p)) return;
  const ring = p.parcel.p[0].map(([la, lo]) => `${lo},${la},0`).join(' ');
  const kml = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><Placemark><name>${[p.taluka, p.village].filter(Boolean).join(' - ')} Gat ${p.gat}</name><Polygon><outerBoundaryIs><LinearRing><coordinates>${ring}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark></Document></kml>`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' }));
  a.download = propFileName(p, 'kml');
  a.click();
}

export function exportCsv() {
  const rows = [['Village', 'Taluka', 'District', 'Gat', 'Type', 'Status', 'Area_ha_712', 'Area_ha_GIS', 'Price_lakh', 'Lat', 'Lng', 'Source']].concat(
    PROPS.map((p) => [p.village, p.taluka, p.district, p.gat, p.type, p.status, p.ha712 ?? '', p.gis ?? '', p.price ?? '', p.parcel?.c?.[0] ?? '', p.parcel?.c?.[1] ?? '', p.source]));
  const csv = '﻿' + rows.map((r) => r.map((x) => '"' + String(x).replace(/"/g, '""') + '"').join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = 'AB_Developers_properties.csv';
  a.click();
}
