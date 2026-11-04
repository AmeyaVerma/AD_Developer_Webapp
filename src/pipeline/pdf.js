import * as pdfjs from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

/** Render every page of a PDF (or load an image) to canvases so they can be OCR-ed. */
export async function toCanvases(file, scale = 2.6, onProgress = () => {}) {
  const buf = await file.arrayBuffer();
  const name = file.name || '';
  const toCanvas = (bmp) => { const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height; c.getContext('2d').drawImage(bmp, 0, 0); return c; };
  if (/\.doc$/i.test(name) || file.type === 'application/msword') throw new Error('Old Word files (.doc) cannot be read. Save it as .docx or PDF, or upload the photo itself.');
  if (/\.docx$/i.test(name) || /wordprocessingml/.test(file.type)) {
    // A 7/12 sent in Word is almost always a pasted photo: pull the pictures out of the .docx and read those.
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(buf);
    const media = Object.keys(zip.files).filter((n) => /^word\/media\/.+\.(png|jpe?g|webp|gif|bmp)$/i.test(n)).sort();
    if (!media.length) throw new Error('This Word file has no picture of the 7/12 inside. Paste the photo into the document, or upload the photo or PDF itself.');
    const out = [];
    for (const m of media) out.push(toCanvas(await createImageBitmap(await zip.files[m].async('blob'))));
    return out;
  }
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(name);
  if (!isPdf) {
    try {
      return [toCanvas(await createImageBitmap(new Blob([buf], { type: file.type || 'image/png' })))];
    } catch (e) {
      throw new Error(/\.hei[cf]$/i.test(name) || /hei[cf]/i.test(file.type) ? 'HEIC photos cannot be opened in the browser. Send it as JPG (WhatsApp photos already are) or take a screenshot.' : 'This file could not be opened as a picture. Try a JPG, PNG, WebP, PDF or Word file.');
    }
  }
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  const out = [];
  for (let p = 1; p <= doc.numPages; p++) {
    onProgress(`Rendering page ${p} of ${doc.numPages}`);
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale });
    const c = document.createElement('canvas');
    c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    out.push(c);
  }
  return out;
}
