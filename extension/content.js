// AD Developers — Mahabhulekh fill-in helper.
// What it does: when you arrive from the AD Developers app (the address ends with #adp=...), it fills the 7/12 form
// on bhulekh.mahabhumi.gov.in for you: district, taluka, village and your mobile number.
// What it never does: solve or read the captcha, or press Submit. You type the captcha and submit yourself.
// The details travel in the part of the address after "#", which is never sent to any server; this script removes it
// from the address bar as soon as it has read it.
(() => {
  const PREFIX = 'ContentPlaceHolder1_';
  const $ = (id) => document.getElementById(PREFIX + id);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const until = async (fn, ms = 12000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = fn(); if (v) return v; await wait(200); } return null; };
  const norm = (s) => String(s || '').replace(/[^ऀ-ॿA-Za-z0-9]/g, '').toLowerCase();

  const lev = (a, b) => {
    const m = [...a], n = [...b];
    const d = Array.from({ length: m.length + 1 }, (_, i) => [i, ...new Array(n.length).fill(0)]);
    for (let j = 1; j <= n.length; j++) d[0][j] = j;
    for (let i = 1; i <= m.length; i++) for (let j = 1; j <= n.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (m[i - 1] === n[j - 1] ? 0 : 1));
    return d[m.length][n.length];
  };
  /** The dropdown option that matches the wanted name: exact first, otherwise the closest (and only if it is close). */
  const pick = (sel, want, maxRatio = 0.5) => {
    const w = norm(want);
    if (!sel || !w) return null;
    const opts = [...sel.options].filter((o) => o.value && !/निवडा/.test(o.text));
    const exact = opts.find((o) => norm(o.text) === w);
    if (exact) return { opt: exact, sure: true };
    let best = null, bd = 99;
    for (const o of opts) { const t = norm(o.text); const d = lev(w, t) / Math.max([...w].length, [...t].length); if (d < bd) { bd = d; best = o; } }
    return best && bd <= maxRatio ? { opt: best, sure: false } : null;
  };
  const choose = (sel, opt) => { sel.value = opt.value; sel.dispatchEvent(new Event('change', { bubbles: true })); };

  function banner(lines, tone = 'info') {
    let b = document.getElementById('adp-banner');
    if (!b) {
      b = document.createElement('div');
      b.id = 'adp-banner';
      b.style.cssText = 'position:fixed;top:12px;right:12px;z-index:2147483647;max-width:340px;font:14px/1.45 system-ui,Segoe UI,sans-serif;color:#092e52;background:#fff;border:2px solid #0c4a82;border-radius:12px;padding:12px 14px;box-shadow:0 8px 30px rgba(0,0,0,.25)';
      document.documentElement.appendChild(b);
    }
    b.style.borderColor = tone === 'warn' ? '#c77700' : tone === 'ok' ? '#07845a' : '#0c4a82';
    b.innerHTML = '<b style="display:block;margin-bottom:4px">AD Developers helper</b>' + lines.map((l) => `<div>${l}</div>`).join('') + '<button id="adp-x" style="margin-top:8px;border:1px solid #cfd9e4;background:#f4f7fb;border-radius:8px;padding:3px 10px;cursor:pointer">Close</button>';
    b.querySelector('#adp-x').onclick = () => b.remove();
  }

  const digits = (s) => String(s || '').replace(/[०-९]/g, (c) => '०१२३४५६७८९'.indexOf(c));
  const gparts = (s) => digits(s).split('/').map((x) => x.trim()).filter(Boolean);
  /** Search the village's Gat list by the first number and pick the entry that matches the wanted Gat. */
  async function fillGat(gat) {
    const out = { chosen: '', options: [] };
    const type = $('ddlSelectSearchType');
    if (!type) return out;
    const typeOpt = [...type.options].find((o) => o.value === '2');
    if (!typeOpt) return out;
    choose(type, typeOpt);
    await wait(1800); // the page re-draws the form after the type changes; wait for it like a person would
    const box = await until(() => { const b = $('txtcsno'); return b && b.offsetParent ? b : null; });
    if (!box) return out;
    const want = gparts(gat);
    box.value = want[0] || '';
    box.dispatchEvent(new Event('input', { bubbles: true })); box.dispatchEvent(new Event('change', { bubbles: true }));
    const btn = $('btnsearchfind');
    if (!btn) return out;
    btn.click();
    const list = await until(() => { const l = $('ddlsurveyno'); return l && l.options.length > 1 ? l : null; });
    if (!list) return out;
    const entries = [...list.options].filter((o) => o.value && !/निवडा/.test(o.text));
    const exact = entries.find((o) => gparts(o.text).join('/') === want.join('/'));
    // same first and last number, different letter in the middle: several can exist, so only choose when it is unambiguous
    const similar = entries.filter((o) => { const g = gparts(o.text); return g.length >= 2 && g[0] === want[0] && g[g.length - 1] === want[want.length - 1]; });
    out.options = similar.map((o) => o.text.trim());
    const pickOne = exact || (similar.length === 1 ? similar[0] : null);
    if (pickOne) { choose(list, pickOne); out.chosen = pickOne.text.trim(); }
    return out;
  }

  /** p = { d, t, v, g, m }: district, taluka, village (Marathi, as on the 7/12), Gat, the agent's mobile number. */
  async function fill(p) {
    const done = [], todo = [];
    if (!(await until(() => $('ddlMainDist')))) { banner(['The 7/12 form was not found on this page.'], 'warn'); return; }
    // record type: 7/12
    const r712 = [...document.querySelectorAll('input[type=radio]')].find((r) => /7\/12/.test((r.closest('td,label,div') || r.parentElement)?.innerText || '') && !/Yes|No|होय|नाही|8|Property/.test((r.closest('td,label,div') || r.parentElement)?.innerText || ''));
    if (r712 && !r712.checked) { r712.click(); await wait(1500); }

    const d = pick($('ddlMainDist'), p.d, 0.3);
    if (d) {
      choose($('ddlMainDist'), d.opt); done.push('District');
      if (await until(() => $('ddlTalForAll') && $('ddlTalForAll').options.length > 1)) {
        const t = pick($('ddlTalForAll'), p.t, 0.4);
        if (t) {
          choose($('ddlTalForAll'), t.opt); done.push('Taluka');
          if (await until(() => $('ddlVillForAll') && $('ddlVillForAll').options.length > 1)) {
            const v = pick($('ddlVillForAll'), p.v, 0.45);
            if (v) { choose($('ddlVillForAll'), v.opt); done.push(v.sure ? 'Village' : `Village (closest match: ${v.opt.text.trim()} — check it)`); }
            else todo.push('Choose the village' + (p.v ? ` (the 7/12 says: ${p.v})` : ''));
          } else todo.push('Choose the village');
        } else todo.push('Choose the taluka');
      } else todo.push('Choose the taluka');
    } else todo.push('Choose the district');

    // Gat: the site lists every Gat of the village. Search by the first number, then choose the entry that matches.
    if (p.g && done.includes('Village') || (p.g && done.some((x) => x.startsWith('Village')))) {
      const gat = await fillGat(p.g);
      if (gat.chosen) done.push(`Gat ${gat.chosen}`);
      else if (gat.options.length) todo.push(`Gat <b>${p.g}</b> is not in the site's list. Closest entries: <b>${gat.options.slice(0, 6).join(', ')}</b> — pick the one on the document`);
      else todo.push(`Gat / Survey No.: <b>${p.g}</b> (enter it and press Search)`);
    } else if (p.g) todo.push(`Gat / Survey No.: <b>${p.g}</b> (choose the survey type, enter it and press Search)`);
    const mob = $('txtmobile1');
    if (mob && p.m) { mob.value = p.m; mob.dispatchEvent(new Event('input', { bubbles: true })); done.push('Mobile number'); }
    else if (!p.m) todo.push('Enter your mobile number (none is saved on your profile — ask the Admin to add it)');

    const cap = $('txtcaptcha');
    if (cap) cap.focus();
    todo.push('<b>Type the captcha</b> and press <b>Submit</b>');
    banner([done.length ? `Filled in: ${done.join(', ')}.` : 'Nothing could be filled in.', 'Still to do:', ...todo.map((x) => `• ${x}`)], done.length ? 'ok' : 'warn');
  }

  function readPayload() {
    const m = location.hash.match(/adp=([^&]+)/);
    if (!m) return null;
    try { return JSON.parse(decodeURIComponent(escape(atob(m[1].replace(/-/g, '+').replace(/_/g, '/'))))); } catch (e) { return null; }
  }

  if (globalThis.__ADP_TEST) { globalThis.__adp = { fill, pick, fillGat }; return; }
  const payload = readPayload();
  if (!payload) return;
  history.replaceState(null, '', location.pathname + location.search); // remove the details from the address bar
  const go = () => fill(payload);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
