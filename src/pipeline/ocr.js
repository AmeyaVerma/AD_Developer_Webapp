import { createWorker } from 'tesseract.js';

/**
 * OCR in the browser (Marathi + English). The 7/12 PDF's own text layer uses a legacy font encoding,
 * so ordinary PDF text extraction returns garbage; rendering the page and reading it with OCR works.
 * Language data is downloaded once from a CDN and cached by the browser.
 */
export async function ocrCanvases(canvases, onProgress = () => {}) {
  const worker = await createWorker('mar+eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') onProgress(`Reading text… ${Math.round(m.progress * 100)}%`);
      else if (m.status) onProgress(m.status.replace(/_/g, ' '));
    },
  });
  const pages = [];
  try {
    for (let i = 0; i < canvases.length; i++) {
      onProgress(`Reading page ${i + 1} of ${canvases.length}`);
      const { data } = await worker.recognize(canvases[i]);
      pages.push({ text: data.text, confidence: Math.round(data.confidence) });
    }
  } finally {
    await worker.terminate();
  }
  return pages;
}
