// Sends the Mahabhulekh record the agent is looking at back to the AD Developers app, as a PDF.
// It prints the open tab to PDF (Chrome shows a "debugging this browser" bar for a moment — that is how an extension
// can print a page) and uploads it to the one-time upload link the app created for this document.
const toBlob = (b64) => { const bin = atob(b64); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return new Blob([u8], { type: 'application/pdf' }); };

async function printToPdf(tabId) {
  const target = { tabId };
  await chrome.debugger.attach(target, '1.3');
  try {
    const r = await chrome.debugger.sendCommand(target, 'Page.printToPDF', { printBackground: true, paperWidth: 8.27, paperHeight: 11.69, marginTop: 0.4, marginBottom: 0.4, marginLeft: 0.4, marginRight: 0.4, preferCSSPageSize: false });
    return r.data;
  } finally {
    try { await chrome.debugger.detach(target); } catch (e) { /* already detached */ }
  }
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg?.type !== 'send-record') return false;
  (async () => {
    try {
      const { adpUpload } = await chrome.storage.local.get('adpUpload');
      if (!adpUpload || Date.now() > adpUpload.exp) { reply({ ok: false, error: 'This link has expired. Click "Fetch original" in the app again.' }); return; }
      const pdf = toBlob(await printToPdf(sender.tab.id));
      const form = new FormData();
      form.append('cacheControl', '3600');
      form.append('', pdf);
      const r = await fetch(adpUpload.url, { method: 'PUT', headers: { apikey: adpUpload.key, Authorization: `Bearer ${adpUpload.key}`, 'x-upsert': 'false' }, body: form });
      if (!r.ok) { reply({ ok: false, error: `The app refused the file (${r.status}).` }); return; }
      await chrome.storage.local.remove('adpUpload'); // one-time
      reply({ ok: true });
    } catch (e) {
      reply({ ok: false, error: String((e && e.message) || e) });
    }
  })();
  return true; // reply later
});
