// Image clean-up before OCR. Phone photos and photocopies of a 7/12 are shaded, slightly tilted and low-contrast,
// which wrecks Devanagari OCR. We (1) enlarge, (2) straighten, (3) remove uneven lighting, (4) optionally binarize.
// Each step works on a canvas, so it needs no server and no extra library.

const cloneCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

export function scaleTo(src, targetW = 2400) {
  const k = Math.min(3, Math.max(0.5, targetW / src.width));
  const c = cloneCanvas(Math.round(src.width * k), Math.round(src.height * k));
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

function toGray(c) {
  const ctx = c.getContext('2d');
  const d = ctx.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < d.data.length; i += 4) { const g = 0.299 * d.data[i] + 0.587 * d.data[i + 1] + 0.114 * d.data[i + 2]; d.data[i] = d.data[i + 1] = d.data[i + 2] = g; }
  ctx.putImageData(d, 0, 0);
  return c;
}

/** Divide by a heavily blurred copy: removes the dark gradient of a photo while keeping the ink. */
export function flatten(src) {
  const c = toGray(scaleTo(src, src.width));
  const w = c.width, h = c.height;
  const blurC = cloneCanvas(w, h);
  const bctx = blurC.getContext('2d');
  bctx.filter = `blur(${Math.max(12, Math.round(w / 28))}px)`;
  bctx.drawImage(c, 0, 0);
  const a = c.getContext('2d').getImageData(0, 0, w, h);
  const b = bctx.getImageData(0, 0, w, h);
  for (let i = 0; i < a.data.length; i += 4) {
    const bg = Math.max(30, b.data[i]);
    let v = (a.data[i] / bg) * 235;
    v = v > 255 ? 255 : v;
    // gentle contrast boost around the paper level
    v = v > 200 ? 255 : v * 1.0;
    a.data[i] = a.data[i + 1] = a.data[i + 2] = v;
  }
  c.getContext('2d').putImageData(a, 0, 0);
  return c;
}

function otsu(gray) {
  const hist = new Array(256).fill(0);
  for (let i = 0; i < gray.length; i += 4) hist[gray[i] | 0]++;
  const total = gray.length / 4;
  let sum = 0; for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0, wB = 0, best = 0, thr = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]; if (!wB) continue;
    const wF = total - wB; if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) { best = between; thr = t; }
  }
  return thr;
}

export function binarize(flat) {
  const c = cloneCanvas(flat.width, flat.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(flat, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height);
  const thr = otsu(d.data) * 1.02;
  for (let i = 0; i < d.data.length; i += 4) { const v = d.data[i] > thr ? 255 : 0; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; }
  ctx.putImageData(d, 0, 0);
  return c;
}

export function rotate(src, deg) {
  const rad = (deg * Math.PI) / 180;
  const c = cloneCanvas(src.width, src.height);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.translate(c.width / 2, c.height / 2); ctx.rotate(rad); ctx.drawImage(src, -src.width / 2, -src.height / 2);
  return c;
}

/** Skew in degrees (−6..6), found by rotating a small copy and keeping the angle where text lines are sharpest. */
export function estimateSkew(flatCanvas) {
  const W = 520, H = Math.round((flatCanvas.height / flatCanvas.width) * W);
  const small = cloneCanvas(W, H); small.getContext('2d').drawImage(flatCanvas, 0, 0, W, H);
  let best = 0, bestScore = -1;
  for (let a = -6; a <= 6.01; a += 0.5) {
    const r = rotate(small, a);
    const d = r.getContext('2d').getImageData(0, 0, W, H).data;
    const rows = new Array(H).fill(0);
    for (let y = 0; y < H; y++) { let n = 0; for (let x = 0; x < W; x++) if (d[(y * W + x) * 4] < 140) n++; rows[y] = n; }
    let score = 0; for (let y = 1; y < H; y++) score += (rows[y] - rows[y - 1]) ** 2;
    if (score > bestScore) { bestScore = score; best = a; }
  }
  return best;
}

/** Cleaned-up versions of one page to OCR (best first). */
export function variants(srcCanvas) {
  let c = toGray(scaleTo(srcCanvas, 2400));
  const flat0 = flatten(c);
  const skew = estimateSkew(flat0);
  if (Math.abs(skew) >= 0.5) c = rotate(c, skew);
  const flat = flatten(c);
  return { skew, list: [flat, binarize(flat)] };
}
