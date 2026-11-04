import { toCanvases } from './pdf';
import { variants } from './prep';
import { createWorker } from 'tesseract.js';
import { parse712 } from './parse712';

const KEY_LINE = /गाव|ULPIN|उपविभाग|तालुका|जिल्हा|क्रमांक/;

function crop(src, b, pad = 14, scale = 2.5) {
  const x = Math.max(0, b.x0 - pad), y = Math.max(0, b.y0 - pad);
  const w = Math.min(src.width - x, b.x1 - b.x0 + pad * 2), h = Math.min(src.height - y, b.y1 - b.y0 + pad * 2);
  const c = document.createElement('canvas');
  c.width = Math.round(w * scale); c.height = Math.round(h * scale);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, x, y, w, h, 0, 0, c.width, c.height);
  return c;
}

/**
 * Read a 7/12 from a photo, scan, PDF or Word file.
 * Pass 1: the whole page, cleaned up (enlarged, straightened, evenly lit) in two versions.
 * Pass 2: every line that carries a key field (village, taluka, district, Gat, ULPIN) is cut out, enlarged and read
 * again on its own — single lines are read far more accurately than a full page, and digits matter most.
 * All the text is parsed together, so a value printed twice on the page (Form 7 and Form 12) is read many times over
 * and the values the readings agree on win. Returns the parse712 shape plus { skew, readings }.
 */
export async function readDocument(file, onProgress = () => {}) {
  const pages = await toCanvases(file, 2.6, onProgress);
  const worker = await createWorker('mar+eng', 1, {
    logger: (m) => { if (m.status === 'recognizing text') onProgress(`Reading text… ${Math.round(m.progress * 100)}%`); },
  });
  const texts = [];
  let skew = 0;
  try {
    for (let i = 0; i < pages.length; i++) {
      onProgress(`Cleaning up page ${i + 1} of ${pages.length}…`);
      const v = variants(pages[i]);
      skew = v.skew;
      const [flat, bin] = v.list;
      for (const [k, img] of [flat, bin].entries()) {
        onProgress(`Reading page ${i + 1} (${k + 1} of 2)…`);
        const { data } = await worker.recognize(img);
        texts.push(data.text);
        const keyLines = (data.lines || []).filter((l) => KEY_LINE.test(l.text) && l.bbox && (l.bbox.x1 - l.bbox.x0) > 60);
        await worker.setParameters({ tessedit_pageseg_mode: '7' });
        let n = 0;
        for (const l of keyLines.slice(0, 14)) {
          onProgress(`Re-reading key lines (${++n} of ${Math.min(keyLines.length, 14)})…`);
          for (const src of [flat, bin]) {
            const r = await worker.recognize(crop(src, l.bbox));
            texts.push(r.data.text);
          }
        }
        await worker.setParameters({ tessedit_pageseg_mode: '3' });
      }
    }
  } finally {
    await worker.terminate();
  }
  const parsed = parse712([{ text: texts.join('\n'), confidence: 0 }]);
  return { ...parsed, skew, readings: texts.length };
}
