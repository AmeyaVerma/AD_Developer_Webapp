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
const TALUKAS = { पनवेल: 'Panvel', उरण: 'Uran', कर्जत: 'Karjat', खालापूर: 'Khalapur', अलिबाग: 'Alibag', पेण: 'Pen', मुरुड: 'Murud', माणगाव: 'Mangaon', रोहा: 'Roha', सुधागड: 'Sudhagad', तळा: 'Tala', महाड: 'Mahad', पोलादपूर: 'Poladpur', म्हसळा: 'Mhasla', श्रीवर्धन: 'Shrivardhan' };
// Official taluka names per district, used to repair OCR slips (e.g. परवेल -> पनवेल). Districts not listed are left as read.
const TALUKA_BY_DISTRICT = {
  रायगड: ['अलिबाग', 'पेण', 'मुरुड', 'पनवेल', 'उरण', 'कर्जत', 'खालापूर', 'माणगाव', 'रोहा', 'सुधागड', 'तळा', 'महाड', 'पोलादपूर', 'म्हसळा', 'श्रीवर्धन'],
  ठाणे: ['ठाणे', 'कल्याण', 'भिवंडी', 'शहापूर', 'मुरबाड', 'उल्हासनगर', 'अंबरनाथ'],
  पालघर: ['पालघर', 'वसई', 'डहाणू', 'तलासरी', 'जव्हार', 'मोखाडा', 'वाडा', 'विक्रमगड'],
  पुणे: ['हवेली', 'मुळशी', 'मावळ', 'भोर', 'वेल्हे', 'खेड', 'आंबेगाव', 'जुन्नर', 'शिरूर', 'दौंड', 'बारामती', 'इंदापूर', 'पुरंदर'],
};
const ALL_TALUKAS = [...new Set(Object.values(TALUKA_BY_DISTRICT).flat())];

const lev = (a, b) => {
  const m = [...a], n = [...b];
  const d = Array.from({ length: m.length + 1 }, (_, i) => [i, ...new Array(n.length).fill(0)]);
  for (let j = 1; j <= n.length; j++) d[0][j] = j;
  for (let i = 1; i <= m.length; i++) for (let j = 1; j <= n.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (m[i - 1] === n[j - 1] ? 0 : 1));
  return d[m.length][n.length];
};
/** Closest official name to a possibly mis-read word, or '' if nothing is close enough. */
export const nearest = (word, list, maxRatio = 0.45) => {
  const w = String(word || '').replace(/[^ऀ-ॿ]/g, '');
  if (w.length < 2) return '';
  let best = '', bd = 99;
  for (const x of list) { const dd = lev(w, x); if (dd < bd) { bd = dd; best = x; } }
  return best && bd / Math.max([...best].length, [...w].length) <= maxRatio ? best : '';
};
const votes = (arr) => { const c = {}; arr.forEach((x) => { if (x) c[x] = (c[x] || 0) + 1; }); return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([v, n]) => ({ v, n })); };
export const enDistrict = (mr) => DISTRICTS[mr] || '';
export const enTaluka = (mr) => TALUKAS[mr] || '';

export function parse712(pages) {
  const raw = pages.map((p) => p.text).join('\n');
  const text = toAscii(raw);
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const first = (re, src = text) => { const m = src.match(re); return m ? m[1].trim() : ''; };

  const vLine = lines.find((l) => /गाव\s*:/.test(l) && /\(\s*\d{6}\s*\)/.test(l)) || '';
  const codeVotes = votes([...text.matchAll(/[(\[]\s*(\d{6})\s*[)\]]/g)].map((m) => m[1]));
  const villageCode = (codeVotes[0] || { v: first(/\(\s*(\d{6})\s*\)/, vLine) }).v;
  const codeSure = codeVotes.length > 0 && codeVotes[0].n >= 2 && (codeVotes.length === 1 || codeVotes[0].n > codeVotes[1].n);
  // The village line is printed twice (Form 7 and Form 12), so read both and keep the name that agrees with the code.
  const vNames = [...text.matchAll(/([ऀ-ॿ]{2,}(?:\s[ऀ-ॿ]{2,})?)\s*[(\[]\s*(\d{6})\s*[)\]]/g)].filter((m) => m[2] === villageCode).map((m) => m[1].trim());
  const villageMr = (votes(vNames)[0] || { v: '' }).v;
  const districtWords = [...text.matchAll(/जिल्हा\s*[:\-ः]*\s*([^\s:,.|]+)/g)].map((m) => nearest(m[1], Object.keys(DISTRICTS), 0.5));
  let district = (votes(districtWords)[0] || { v: '' }).v;
  if (!district) district = nearest(first(/जिल्हा\s*:-?\s*([^\s:]+)/), Object.keys(DISTRICTS), 0.5);
  const talukaWords = [...text.matchAll(/तालुका\s*[:\-ः]*\s*([^\s:,.|]+)/g)].map((m) => nearest(m[1], TALUKA_BY_DISTRICT[district] || ALL_TALUKAS, 0.5));
  const taluka = (votes(talukaWords)[0] || { v: '' }).v;
  // Gat is printed like 88, 88/1 or 1/अ/42 (number / sub-division letter / number). Read it from both headers.
  const gatCands = [];
  const LATIN = { a: 'अ', A: 'अ', b: 'ब', B: 'ब', c: 'क', C: 'क', d: 'ड', D: 'ड' }; // OCR often writes अ as a Latin "a"
  for (const m of text.matchAll(/उपविभाग\s*[:\-ः]*\s*([^\n]{1,24})/g)) {
    const chunk = m[1];
    const full = chunk.match(/(\d+)\s*[\/|।॥]\s*([A-Za-z]|[अ-ह])\s*[\/|।॥]\s*(\d+)/);
    const two = chunk.match(/(\d+)\s*[\/|।॥]\s*(\d+)/);
    const nums = chunk.match(/\d+/g) || [];
    if (full) gatCands.push(`${full[1]}/${LATIN[full[2]] || full[2]}/${full[3]}`);
    else if (two) gatCands.push(`${two[1]}/${two[2]}`);
    else if (nums.length) gatCands.push(nums[nums.length - 1]);
  }
  // A partial reading (just "42") supports the fuller one ("1/अ/42") when they end in the same number: prefer the fullest.
  const tail = (g) => g.split('/').pop();
  const tailTop = (votes(gatCands.map(tail))[0] || { v: '' }).v;
  const gatPool = gatCands.filter((g) => tail(g) === tailTop);
  const gat = gatPool.sort((x, y) => y.split('/').length - x.split('/').length || gatPool.filter((g) => g === y).length - gatPool.filter((g) => g === x).length)[0] || '';
  const puid = first(/PU-?ID\s*:?\s*(\d{8,})/) || (votes([...text.matchAll(/ULPIN\s*:?\s*(\d{11})\b/g)].map((m) => m[1]))[0] || { v: '' }).v;
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
      district: f(district, !!district && !!DISTRICTS[district]),
      taluka: f(taluka, !!taluka && (TALUKA_BY_DISTRICT[district] || []).includes(taluka)),
      village: f(villageMr, !!villageMr && vNames.filter((x) => x === villageMr).length >= 2),
      villageCode: f(villageCode, /^\d{6}$/.test(villageCode) && codeSure),
      gat: f(gat, /^\d+(\/[0-9A-Za-zऀ-ॿ]+)*$/.test(gat) && gatCands.filter((x) => x === gat).length >= 2),
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

/** Combine the parses of several cleaned-up versions of the same page: the value most readings agree on wins. */
export function mergeParses(parsed) {
  const base = parsed[0];
  const fields = {};
  Object.keys(base.fields).forEach((k) => {
    const vals = parsed.map((p) => p.fields[k]).filter((f) => f.value);
    if (!vals.length) { fields[k] = base.fields[k]; return; }
    const top = votes(vals.map((f) => f.value))[0];
    const agree = top.n >= 2;
    const anyOk = vals.some((f) => f.value === top.v && f.status === 'ok');
    fields[k] = { value: top.v, status: (agree || anyOk) ? (anyOk || agree ? 'ok' : 'check') : 'check' };
    // a lone, unconfirmed reading stays 'check' so the person confirms it
    if (!agree && !anyOk) fields[k].status = 'check';
  });
  return { fields, areaTokens: [...new Set(parsed.flatMap((p) => p.areaTokens))], raw: parsed.map((p) => p.raw).join('\n----\n') };
}
