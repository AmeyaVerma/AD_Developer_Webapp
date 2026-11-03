import JSZip from 'jszip';

const esc = (s) => String(s ?? '').replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));

/** Build a KMZ (zipped KML) with the plot outline, a pin and the 7/12 details in the pop-up. */
export async function buildKmz({ title, center, rings, details, exact }) {
  const rows = Object.entries(details).filter(([, v]) => v).map(([k, v]) => `<tr><td><b>${esc(k)}</b></td><td>${esc(v)}</td></tr>`).join('');
  const desc = `<![CDATA[<table>${rows}</table><p>${exact ? 'Plot boundary from the cadastral map.' : 'Approximate village location — no plot boundary available.'}</p>]]>`;
  const polygon = rings && rings.length
    ? `<Placemark><name>${esc(title)} – plot</name><description>${desc}</description><styleUrl>#plot</styleUrl><Polygon><tessellate>1</tessellate><outerBoundaryIs><LinearRing><coordinates>${rings[0].map(([la, lo]) => `${lo},${la},0`).join(' ')}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>`
    : '';
  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${esc(title)}</name>
<Style id="plot"><LineStyle><color>ff9dff00</color><width>3</width></LineStyle><PolyStyle><color>4d4fbf2f</color></PolyStyle></Style>
<Style id="pin"><IconStyle><scale>1.2</scale><Icon><href>http://maps.google.com/mapfiles/kml/paddle/red-circle.png</href></Icon></IconStyle></Style>
${polygon}
<Placemark><name>${esc(title)}</name><description>${desc}</description><styleUrl>#pin</styleUrl><Point><coordinates>${center[1]},${center[0]},0</coordinates></Point></Placemark>
</Document></kml>`;
  const zip = new JSZip();
  zip.file('doc.kml', kml);
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/vnd.google-earth.kmz' });
}

export function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
}
