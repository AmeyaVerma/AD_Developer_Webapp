import * as pdfjs from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

/** Render every page of a PDF (or load an image) to canvases so they can be OCR-ed. */
export async function toCanvases(file, scale = 2.6, onProgress = () => {}) {
  const buf = await file.arrayBuffer();
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
  if (!isPdf) {
    const bmp = await createImageBitmap(new Blob([buf], { type: file.type || 'image/png' }));
    const c = document.createElement('canvas');
    c.width = bmp.width; c.height = bmp.height;
    c.getContext('2d').drawImage(bmp, 0, 0);
    return [c];
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
