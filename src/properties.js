// Shared logic for adding properties: validation, unit conversion, location lookup, Excel import.
import { findDuplicate, newId } from './data';
import { findParcel, library } from './pipeline/library';

export const TYPES = ['Agricultural land', 'Residential plot (NA)', 'Commercial', 'Industrial', 'Other'];
export const AUTHORITIES = ['NAINA', 'TPS', 'MSRDC', 'MMRDA', 'PMC', 'Other'];
export const STATUSES = ['Available', 'Under offer', 'Sold'];
export const UNITS = ['ha', 'acre', 'guntha', 'sq m', 'H.R.Sq.m'];

const TYPE_WORDS = [[/agri|farm|shet|jirayat|bagayat/i, 'Agricultural land'], [/resid|plot|na\b|n\.a|non.?agri|house|bunglow|bungalow/i, 'Residential plot (NA)'], [/commerc|shop|office/i, 'Commercial'], [/industr|factory|warehouse/i, 'Industrial']];
export const normType = (s) => { const v = String(s || '').trim(); if (!v) return { value: 'Agricultural land', guessed: true }; const hit = TYPE_WORDS.find(([re]) => re.test(v)); return hit ? { value: hit[1] } : { value: 'Other', guessed: true }; };
export const normStatus = (s) => {
  const v = String(s || '').trim().toLowerCase();
  if (!v) return { value: 'Available', guessed: true };
  if (/sold/.test(v)) return { value: 'Sold' };
  if (/offer|book|hold|reserv|negot/.test(v)) return { value: 'Under offer' };
  if (/avail|sale|open|vacant|new/.test(v)) return { value: 'Available' };
  return { value: 'Available', guessed: true };
};

/** Convert an area to hectares. "H.R.Sq.m" is the 7/12 format hectare.are.sq-m (2.33.00 = 2 ha 33 are). */
export function toHectares(value, unit = 'ha') {
  const raw = String(value ?? '').trim();
  if (!raw) return { ha: null };
  const u = String(unit || 'ha').toLowerCase().replace(/[^a-z.]/g, '');
  const hr = raw.match(/^(\d+)\.(\d{2})\.(\d{2})$/);
  if (hr) return { ha: Number(hr[1]) + Number(hr[2]) / 100 + Number(hr[3]) / 10000 };
  const num = parseFloat(raw.replace(/,/g, '').match(/-?\d+(\.\d+)?/)?.[0]);
  if (!Number.isFinite(num) || num <= 0) return { error: 'Area must be a positive number' };
  const factor = /acre/.test(u) ? 0.404686 : /gunth/.test(u) ? 0.010117 : /sqm|sqmeter|squarem|m2/.test(u) ? 0.0001 : /sqft|sqfeet/.test(u) ? 0.0000092903 : 1;
  return { ha: +(num * factor).toFixed(4) };
}

const inIndia = (lat, lng) => lat >= 6 && lat <= 38 && lng >= 68 && lng <= 98;

/** Look up the plot outline (from the village map library) or fall back to given coordinates. */
export function resolveLocation({ villageCode, village, gat, lat, lng }) {
  const lib = library();
  const entry = (villageCode && lib[villageCode]) || Object.values(lib).find((v) => v.village.toLowerCase() === String(village || '').trim().toLowerCase());
  if (entry) {
    const hit = findParcel(entry.code, gat);
    if (hit) return { parcel: { pin: hit.parcel.gat, ha: hit.parcel.ha, c: hit.parcel.c, p: hit.parcel.p }, entry, how: 'outline' };
  }
  if (Number.isFinite(lat) && Number.isFinite(lng) && inIndia(lat, lng)) return { parcel: { pin: String(gat), ha: null, c: [lat, lng], p: [] }, entry, how: 'pin' };
  return { parcel: null, entry, how: 'none' };
}

/** Build a property object. `f` holds already-validated, normalised fields. */
export function makeProperty(f, source) {
  const loc = f.parcel !== undefined ? { parcel: f.parcel, entry: null } : resolveLocation(f);
  const village = f.village || loc.entry?.village || '';
  const p = {
    gat: String(f.gat).trim(), village, villageCode: f.villageCode || loc.entry?.code || '',
    taluka: f.taluka || loc.entry?.taluka || '', district: f.district || loc.entry?.district || '', state: 'Maharashtra',
    type: f.type, status: f.status, planningAuthority: f.planningAuthority || 'Other', mou: !!f.mou, soldHa: Number(f.soldHa) > 0 ? Number(f.soldHa) : 0, agent: f.agent || '', approval: f.approval || 'approved', price: f.price ?? null, haDeclared: f.ha ?? null, ha712: f.ha712 ?? null,
    gis: loc.parcel?.ha ?? null, parcel: loc.parcel, real: false, source,
    desc: f.desc || `${f.type} at ${village || 'the listed village'}${f.taluka ? `, ${f.taluka}` : ''}.`,
    features: [], createdAt: new Date().toISOString(),
    record712: f.record712 || null,
  };
  if (p.parcel?.p?.length) p.features.push('Boundary on cadastral KML');
  else if (p.parcel) p.features.push('Location pinned');
  p.features.push(f.record712 ? 'Added from 7/12 document' : source === 'excel' ? 'Imported from Excel' : 'Added manually');
  p.id = newId(p);
  return p;
}

/** Validate a manual / document form. Returns { errors: {field: msg}, clean }. */
export function validateForm(v) {
  const errors = {};
  const gat = String(v.gat || '').trim();
  if (!gat) errors.gat = 'Gat / survey number is required';
  else if (!/^\d+(\s*\/\s*[0-9A-Za-z]+)?$/.test(gat)) errors.gat = 'Use digits, optionally with a sub-division, e.g. 88 or 88/1';
  if (!String(v.village || '').trim() && !String(v.villageCode || '').trim()) errors.village = 'Village is required';
  if (v.villageCode && !/^\d{6}$/.test(String(v.villageCode).trim())) errors.villageCode = 'Village code is 6 digits';
  const a = toHectares(v.area, v.unit);
  if (a.error) errors.area = a.error;
  let price = null;
  if (String(v.price ?? '').trim() !== '') { price = Number(String(v.price).replace(/[₹,\s]|lakh/gi, '')); if (!Number.isFinite(price) || price < 0) errors.price = 'Price must be a number (in lakh)'; }
  const lat = v.lat === '' || v.lat == null ? NaN : Number(v.lat), lng = v.lng === '' || v.lng == null ? NaN : Number(v.lng);
  if ((v.lat !== '' && v.lat != null) !== (v.lng !== '' && v.lng != null)) errors.lat = 'Enter both latitude and longitude, or neither';
  else if (Number.isFinite(lat) && !inIndia(lat, lng)) errors.lat = 'These coordinates are outside India';
  const clean = { ...v, gat, village: String(v.village || '').trim(), villageCode: String(v.villageCode || '').trim(), taluka: String(v.taluka || '').trim(), district: String(v.district || '').trim(),
    type: normType(v.type).value, status: normStatus(v.status).value, ha: a.ha ?? null, price, lat, lng };
  if (!errors.gat && !errors.village) {
    const dup = findDuplicate({ ...clean, villageCode: clean.villageCode || resolveLocation(clean).entry?.code || '' });
    if (dup) errors.gat = `Already exists: ${dup.village} Gat ${dup.gat}`;
  }
  return { errors, clean };
}
