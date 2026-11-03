// Turns the OCR text of a 7/12 into fields. OCR of Devanagari is imperfect, so every field gets a status
// ('ok' = matched and passed a sanity check, 'check' = the user must confirm it).
const DEV = '०१२३४५६७८९';
export const toAscii = (s) => String(s).replace(/[०-९]/g, (d) => DEV.indexOf(d));

// Marathi → English names, used for map searches and display.
const DISTRICTS = {
  अहमदनगर: 'Ahmednagar', अकोला: 'Akola', अमरावती: 'Amravati', औरंगाबाद: 'Chhatrapati Sambhajinagar', बीड: 'Beed', भंडारा: 'Bhandara', बुलढाणा: 'Buldhana', चंद्रपूर: 'Chandrapur',
  धुळे: 'Dhule', गडचिरोली: 'Gadchiroli', गोंदिया: 'Gondia', हिंगोली: 'Hingoli', जळगाव: 'Jalgaon', जालना: 'Jalna', कोल्हापूर: 'Kolhapur', लातूर: 'Latur', नागपूर: 'Nagpur', नांदेड: 'Nanded',
  नंदुरबार: 'Nandurbar', नाशिक: 'Nashik', उस्मानाबाद: 'Dharashiv', धाराशिव: 'Dharashiv', पालघर: 'Palghar', परभणी: 'Parbhani', पुणे: 'Pune', रायगड: 'Raigad', रत्नागिरी: 'Ratnagiri', सांगली: 'Sangli',
  सातारा: 'Satara', सिंधुदुर्ग: 'Sindhudurg', सोलापूर: 'Solapur', ठाणे: 'Thane', वर्धा: 'Wardha', वाशिम: 'Washim', यवतमाळ: 'Yavatmal',
};
const TALUKAS = { पनवेल: 'Panvel', उरण: 'Uran', कर्जत: 'Karjat', खालापूर: 'Khalapur', अलिबाग: 'Alibag', पेण: 'Pen', मुरुड: 'Murud' };
export const enDistrict = (mr) => DISTRICTS[mr] || '';
export const enTaluka = (mr) => TALUKAS[mr] || '';

export function parse712(pages) {
  const raw = pages.map((p) => p.text).join('\n');
  const text = toAscii(raw);
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const first = (re, src = text) => { const m = src.match(re); return m ? m[1].trim() : ''; };

  const vLine = lines.find((l) => /गाव\s*:/.test(l) && /\(\s*\d{6}\s*\)/.test(l)) || '';
  const villageCode = first(/\(\s*(\d{6})\s*\)/, vLine) || first(/\(\s*(\d{6})\s*\)/);
  const villageMr = first(/गाव\s*:-?\s*(.+?)\s*\(\s*\d{6}/, vLine).replace(/[^ऀ-ॿ ]/g, '').trim();
  const taluka = first(/तालुका\s*:-?\s*([^\s:]+)/);
  const district = first(/जिल्हा\s*:-?\s*([^\s:]+)/);
  const gat = first(/गट\s*क्रमांक\s*व\s*उपविभाग\s*([0-9]+(?:\s*\/\s*[0-9A-Za-z]+)?)/).replace(/\s+/g, '');
  const puid = first(/PU-?ID\s*:?\s*(\d{8,})/);
  const tenure = first(/धारणा\s*पद्धती\s*(.+?)\s*(?:शेताचे|$)/m);
  const localName = first(/स्थानीक\s*नाव\s*:?\s*(.+)$/m);
  const pending = first(/प्रलंबित\s*फेरफार\s*:?\s*([^\s.]+)/);
  const lastMut = first(/फेरफार\s*क्रमांक\s*:?\s*(\d{2,4})\s*व/);
  const lastMutDate = first(/(\d{2}\/\d{2}\/\d{4})(?!\s*:\d)/);
  const verifyNo = first(/\b(\d{16})\b/);

  // Holder names: "[ name ... (mutation)" patterns. Needs a human check (OCR can swap letters).
  const holders = [];
  lines.forEach((l) => {
    for (const m of l.matchAll(/\[?\s*([ऀ-ॿ]{2,}(?:\s+[ऀ-ॿ]{2,}){1,3})[\s.\]\d]*\(\s*(\d{3,4})\s*\)/g)) {
      const name = m[1].trim();
      if (!holders.includes(name) && name.split(' ').length <= 4 && !/फेरफार|क्षेत्र|अधिकार/.test(name)) holders.push(name);
    }
  });

  // Area candidates (Ha.R.Sq.m). Digit OCR is the weakest part, so these are only suggestions.
  const areaTokens = [...new Set([...text.matchAll(/\b(\d)\.(\d{2})\.(\d{2})\b/g)].map((m) => m[0]))];

  const f = (value, ok) => ({ value, status: value && ok ? 'ok' : 'check' });
  return {
    fields: {
      district: f(district, /^[ऀ-ॿ]+$/.test(district)),
      taluka: f(taluka, /^[ऀ-ॿ]+$/.test(taluka)),
      village: f(villageMr, false),
      villageCode: f(villageCode, /^\d{6}$/.test(villageCode)),
      gat: f(gat, /^\d+(\/\w+)?$/.test(gat)),
      puid: f(puid, /^\d{11}$/.test(puid)),
      tenure: f(tenure, tenure.length > 3),
      localName: f(localName, localName.length > 2),
      holders: f(holders.join('\n'), false),
      area: f('', false),
      pending: f(pending, /नाही|आहे/.test(pending)),
      lastMut: f(lastMut ? `${lastMut}${lastMutDate ? ` (${lastMutDate})` : ''}` : '', /^\d{2,4}/.test(lastMut)),
      verifyNo: f(verifyNo, /^\d{16}$/.test(verifyNo)),
    },
    areaTokens,
    raw,
  };
}
