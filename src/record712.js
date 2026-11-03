// 7/12 records on file, keyed by gat number. Gat 88 is transcribed from the client's Satbara PDF
// (Form 7 signed 10/11/2024 08:33:54 PM, downloaded 29-08-2026 13:58:55, verification no. 2402100001290321).
// Names are given in Marathi (as on the record) and in English (transliterated by us — verify before use).
const nm = (en, mr) => ({ en, mr });

const CHHAYA = nm('Chhaya Rajaram Patil', 'छाया राजाराम पाटील');
const AJAY = nm('Ajay Mahadev Jadhav', 'अजय महादेव जाधव');
const SANJAY = nm('Sanjay Mahadev Jadhav', 'संजय महादेव जाधव');

export const RECORDS = {
  88: {
    village: nm('Nanoshi (553456)', 'नानोशी (५५३४५६)'),
    taluka: nm('Panvel', 'पनवेल'),
    district: nm('Raigad', 'रायगड'),
    puid: '18037120268',
    gat: '88',
    tenure: nm('Bhogwatdar Class-1', 'भोगवटादार वर्ग -१'),
    localName: nm('Divticha Mal', 'दिवटीचा माळ'),
    areas: { jirayat: '2.13.00', bagayat: '-', cultivableTotal: '2.13.00', potA: '0.20.00', potB: '-', potTotal: '0.20.00', total: '2.33.00', aakar: '4.75' },
    khatas: [
      { khata: '146', entries: [{ o: CHHAYA, area: '2.13.00', aakar: '4.75', pot: '0.20.00', mut: '705' }] },
      { khata: '154', entries: [{ o: nm('Collector & Deputy Custodian, Evacuee Property', 'कलेक्टर व डेप्यूटी कस्टोडियन इव्हॅक्यु प्रापर्टी'), area: '2.13.00', aakar: '4.75', pot: '0.20.00', mut: '731' }] },
      { khata: '170', entries: [{ o: CHHAYA, area: '2.13.00', aakar: '4.75', pot: '0.20.00', mut: '802' }] },
      { khata: '200', entries: [{ o: nm('Satish Balaso Patil', 'सतीश बाळासो पाटील'), mut: '848' }, { o: AJAY, mut: '848' }, { o: SANJAY, mut: '848' }], common: { area: '0.00.00', aakar: '0' } },
      { khata: '223', entries: [{ o: AJAY, mut: '848' }, { o: SANJAY, mut: '848' }], common: { area: '2.13.00', aakar: '4.75', pot: '0.20.00' } },
    ],
    otherRights: [nm('Pandya & Co. Solicitors (21)', 'पंडया आणि कं सॉलिसिटर्स (२१)'), nm('V. D. Ghenar (21)', 'वि.दा.घेणार (२१)')],
    pending: nm('None.', 'नाही.'),
    lastMutation: { no: '848', date: '10/11/2024' },
    oldMutations: ['25', '37', '63', '187', '238', '304', '599', '672', '683', '685', '689', '705', '731', '745', '770', '802', '832'],
    signedAt: '10/11/2024 08:33:54 PM',
    downloadedAt: '29-08-2026 13:58:55',
    downloadedISO: '2026-08-29',
    verifyNo: '2402100001290321',
    form12: [{ year: '2023-24', season: nm('Kharif', 'खरीप'), khata: '200*', unavail: nm('Fallow grass', 'गवत पड'), unavailArea: '2.3300' }],
  },
};

export const hasRecord = (gat) => Object.prototype.hasOwnProperty.call(RECORDS, gat);
