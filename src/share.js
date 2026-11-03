import { SATBARA_88, areaOf, ratingStats } from './data';

const fmtPrice = (p) => (p.price == null ? 'Price on request' : `₹ ${p.price.toFixed(1)} lakh`);

/**
 * WhatsApp-ready text for a property (WhatsApp formats *text* as bold).
 *  level 'public': what is safe to send to anyone — no owner names, no land-record numbers, no internal ratings.
 *  level 'full':   everything, including the 7/12 summary and holders.
 */
export function shareText(p, reports, level = 'full') {
  const area = areaOf(p);
  const [la, lo] = p.parcel ? p.parcel.c : [null, null];
  const lines = [
    level === 'public' ? '*AB Developers – Property*' : '*AB Developers – Property details*',
    `*${p.village} · Gat ${p.gat}*`,
    `Status: ${p.status}`,
    `Type: ${p.type}`,
    `Location: ${[p.village, p.taluka, p.district, p.state].filter(Boolean).join(', ')}`,
    area ? `Area: ${area.toFixed(2)} ha (${(area * 2.471).toFixed(2)} acres / ${Math.round(area * 98.84)} guntha)` : null,
    `Price: ${fmtPrice(p)}`,
  ];

  if (level === 'public') {
    if (la != null) lines.push('', `Map: https://www.google.com/maps/search/?api=1&query=${la},${lo}`);
  } else {
    if (p.real) {
      lines.push('', '*7/12 land record*', 'Tenure: Bhogwatdar Class-1', 'Current holders: Ajay Mahadev Jadhav, Sanjay Mahadev Jadhav', 'Pending mutation: None', 'Last mutation: No. 848 (10/11/2024)', `Verification no.: ${SATBARA_88.verifyId}`);
    } else if (p.record712) {
      const r = p.record712;
      lines.push('', '*7/12 land record*', r.tenure && `Tenure: ${r.tenure}`, r.holders && `Holders: ${r.holders.split('\n').filter(Boolean).join(', ')}`, r.pending && `Pending mutation: ${r.pending}`, r.lastMut && `Last mutation: ${r.lastMut}`, r.verifyNo && `Verification no.: ${r.verifyNo}`);
    }
    if (la != null) lines.push('', `Map: https://www.google.com/maps/search/?api=1&query=${la},${lo}`, `Directions: https://www.google.com/maps/dir/?api=1&destination=${la},${lo}`);
  }
  return lines.filter((l) => l !== null && l !== undefined && l !== false).join('\n').replace(/\n{3,}/g, '\n\n');
}

export const whatsappUrl = (text) => `https://wa.me/?text=${encodeURIComponent(text)}`;
