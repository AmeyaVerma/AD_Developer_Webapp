import fixWebmDuration from 'fix-webm-duration';

// Records a drone-style orbit of the plot from the live map and returns a WebM video.
// Runs in the browser: no server, no cost. (A server-side version can render MP4 with voice-over later.)

const idle = (map, ms = 5000) => new Promise((resolve) => {
  let done = false;
  const fin = () => { if (!done) { done = true; resolve(); } };
  setTimeout(fin, ms);
  if (map.loaded() && !map.isMoving()) fin(); else map.once('idle', fin);
});

export async function recordFlyover(map, { title, subtitle, seconds = 12, onProgress = () => {} }) {
  const W = 1280, H = 720;
  const out = document.createElement('canvas');
  out.width = W; out.height = H;
  const ctx = out.getContext('2d');
  const src = map.getCanvas();
  const c0 = map.getCenter();
  const z0 = Math.min(Math.max(map.getZoom(), 16.4), 17.4);

  // Warm up: visit four headings first so the satellite tiles are already loaded during the recording.
  onProgress('Loading imagery…', 0);
  for (const b of [-30, 60, 150, 170]) {
    map.jumpTo({ center: c0, zoom: z0, pitch: 62, bearing: b });
    await idle(map);
  }
  map.jumpTo({ center: c0, zoom: z0, pitch: 62, bearing: -30 });
  await idle(map);

  const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m));
  if (!mime) throw new Error('This browser cannot record video. Use Chrome or Edge.');
  const rec = new MediaRecorder(out.captureStream(30), { mimeType: mime, videoBitsPerSecond: 6_000_000 });
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise((r) => { rec.onstop = r; });
  rec.start(250);

  const start = performance.now();
  await new Promise((resolve) => {
    const frame = (now) => {
      const t = Math.min((now - start) / (seconds * 1000), 1);
      const e = t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2; // ease in/out
      map.jumpTo({ center: c0, bearing: -30 + 200 * e, zoom: z0 + 0.35 * Math.sin(Math.PI * t), pitch: 62 - 6 * Math.sin(Math.PI * t) });
      const k = Math.max(W / src.width, H / src.height);
      ctx.drawImage(src, (W - src.width * k) / 2, (H - src.height * k) / 2, src.width * k, src.height * k);

      // Captions
      const g = ctx.createLinearGradient(0, H - 190, 0, H);
      g.addColorStop(0, 'rgba(9,46,82,0)'); g.addColorStop(1, 'rgba(9,46,82,0.88)');
      ctx.fillStyle = g; ctx.fillRect(0, H - 190, W, 190);
      ctx.fillStyle = '#fff'; ctx.font = '600 44px Inter, system-ui, sans-serif'; ctx.fillText(title, 48, H - 82);
      ctx.fillStyle = '#d3e3f4'; ctx.font = '400 26px Inter, system-ui, sans-serif'; ctx.fillText(subtitle, 48, H - 40);
      ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.font = '600 24px Inter, system-ui, sans-serif'; ctx.fillText('AB Developers', 48, 52);
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '400 16px Inter, system-ui, sans-serif'; ctx.textAlign = 'right';
      ctx.fillText('Imagery © Esri, Maxar, Earthstar Geographics', W - 24, H - 16); ctx.textAlign = 'left';
      ctx.fillStyle = '#e5483a'; ctx.fillRect(0, H - 6, W * t, 6);

      onProgress('Recording…', t);
      if (t < 1) requestAnimationFrame(frame); else resolve();
    };
    requestAnimationFrame(frame);
  });
  rec.stop();
  await stopped;
  const raw = new Blob(chunks, { type: mime });
  // MediaRecorder writes WebM without a duration, which breaks the seek bar; add it.
  return new Promise((resolve) => { try { fixWebmDuration(raw, Math.round(performance.now() - start), resolve); } catch (e) { resolve(raw); } });
}
