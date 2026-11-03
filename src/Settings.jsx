import { useCallback, useEffect, useState } from 'react';
import { AGENTS, DEMO_MODE } from './auth';
import { supabase } from './supabase';
import { actions } from './store';

const EMPTY = { email: '', password: '', role: 'agent', agent: '' };

const fingerprint = async (pem) => {
  const der = Uint8Array.from(atob(pem.replace(/-----[^-]+-----|\s+/g, '')), (c) => c.charCodeAt(0));
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', der))].map((b) => b.toString(16).padStart(2, '0')).join('');
};

/** Government / licensed-CA certificates whose signature we accept on a 7/12. */
function Authorities() {
  const [rows, setRows] = useState(null);
  const [f, setF] = useState({ name: '', pem: '' });
  const [err, setErr] = useState('');
  const load = useCallback(async () => {
    const { data } = await supabase.from('trusted_roots').select('id, name, fingerprint, created_at').order('created_at');
    setRows(data || []);
  }, []);
  useEffect(() => { load(); }, [load]);
  const add = async (e) => {
    e.preventDefault(); setErr('');
    try {
      if (!/-----BEGIN CERTIFICATE-----/.test(f.pem)) throw new Error('Paste the certificate in PEM format (starts with -----BEGIN CERTIFICATE-----).');
      const fp = await fingerprint(f.pem);
      const { error } = await supabase.from('trusted_roots').insert({ name: f.name.trim(), pem: f.pem.trim(), fingerprint: fp });
      if (error) throw new Error(/duplicate|unique/i.test(error.message) ? 'This certificate is already approved.' : 'Could not add the certificate.');
      setF({ name: '', pem: '' }); load();
    } catch (x) { setErr(String(x.message || x)); }
  };
  const remove = async (id) => { if (window.confirm('Stop accepting 7/12 files signed by this authority?')) { await supabase.from('trusted_roots').delete().eq('id', id); load(); } };
  return (
    <section className="setcard" style={{ gridColumn: '1 / -1' }}>
      <h3>Approved signing authorities</h3>
      <p className="dim small">A 7/12 is accepted as authentic only if its digital signature chains to one of these certificates. Add the certificate of the authority that signs Digital Satbara files — and only that. Adding the wrong one lets false documents through.</p>
      {rows === null ? <p className="dim">Loading…</p> : (
        <table className="settable">
          <thead><tr><th>Name</th><th>Fingerprint (SHA-256)</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => <tr key={r.id}><td>{r.name}</td><td className="mono small">{r.fingerprint.slice(0, 24)}…</td><td><button className="btn ghost sm" onClick={() => remove(r.id)}>Remove</button></td></tr>)}
            {!rows.length && <tr><td colSpan="3" className="dim">None yet — no signed 7/12 can be fully authenticated until you add one.</td></tr>}
          </tbody>
        </table>
      )}
      <form onSubmit={add} noValidate style={{ marginTop: 14 }}>
        <label>Name<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. CCA India root / Maharashtra Revenue signer" /></label>
        <label>Certificate (PEM)<textarea rows="5" value={f.pem} onChange={(e) => setF({ ...f, pem: e.target.value })} placeholder="-----BEGIN CERTIFICATE-----" /></label>
        {err && <p className="lg-err" role="alert">{err}</p>}
        <button className="btn" disabled={!f.name.trim() || !f.pem.trim()}>Approve this authority</button>
      </form>
    </section>
  );
}

/** Admin-only: see all logins and create new ones (Admin, or Agent A/B/J/P). */
export default function Settings() {
  const [accounts, setAccounts] = useState(null);
  const [f, setF] = useState(EMPTY);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    if (DEMO_MODE) { setAccounts([]); return; }
    const { data, error } = await supabase.from('profiles').select('email, role, agent_code, created_at').order('created_at');
    if (error) { setErr('Could not load accounts.'); setAccounts([]); } else setAccounts(data);
  }, []);
  useEffect(() => { load(); }, [load]);

  if (DEMO_MODE) {
    return <div className="card-empty"><b>Accounts need the real login.</b><p className="dim small">Connect Supabase (see .env.example) to create and manage accounts.</p></div>;
  }

  const free = AGENTS.filter((a) => !(accounts || []).some((x) => x.agent_code === a));
  const agentChoice = f.agent || free[0] || '';
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (f.role === 'agent' && !agentChoice) { setErr('All four agent letters already have a login.'); return; }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke('create-user', {
      body: { email: f.email, password: f.password, role: f.role, agent_code: f.role === 'agent' ? agentChoice : null },
    });
    setBusy(false);
    // functions.invoke puts a non-2xx reply in error.context (a Response) — read our own message from it
    let msg = data?.error;
    if (error && !msg) { try { msg = (await error.context.json()).error; } catch (x) { msg = 'Could not create the account.'; } }
    if (msg) { setErr(msg); return; }
    actions.notify(`Account created for ${f.email.trim()}`);
    setF(EMPTY);
    load();
  };

  return (
    <div className="settings">
      <section className="setcard">
        <h3>Create account</h3>
        <p className="dim small">The person logs in with this email and password. Tell them the password in person, and ask them to change it after the first login.</p>
        <form onSubmit={submit} noValidate>
          <label>Email<input type="email" autoComplete="off" value={f.email} onChange={set('email')} placeholder="name@company.com" /></label>
          <label>Password
            <span className="lg-pw">
              <input type={show ? 'text' : 'password'} autoComplete="new-password" value={f.password} onChange={set('password')} placeholder="At least 8 characters" />
              <button type="button" onClick={() => setShow((v) => !v)}>{show ? 'Hide' : 'Show'}</button>
            </span>
          </label>
          <div className="setrow">
            <label>Role
              <select value={f.role} onChange={set('role')}><option value="agent">Agent</option><option value="admin">Admin</option></select>
            </label>
            {f.role === 'agent' && (
              <label>Agent letter
                <select value={agentChoice} onChange={set('agent')} disabled={!free.length}>
                  {free.length ? free.map((a) => <option key={a}>{a}</option>) : <option value="">none free</option>}
                </select>
              </label>
            )}
          </div>
          <p className="small dim">{f.role === 'admin' ? 'An Admin has full access, like you.' : 'An Agent sees only the properties assigned to their letter and price, and can submit new properties for approval.'}</p>
          {err && <p className="lg-err" role="alert">{err}</p>}
          <button className="btn" disabled={busy || !f.email || !f.password}>{busy ? 'Creating…' : 'Create account'}</button>
        </form>
      </section>

      <section className="setcard">
        <h3>Accounts</h3>
        {accounts === null ? <p className="dim">Loading…</p> : (
          <table className="settable">
            <thead><tr><th>Email</th><th>Role</th><th>Agent</th></tr></thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.email}><td>{a.email}</td><td>{a.role === 'admin' ? 'Admin' : 'Agent'}</td><td>{a.agent_code || '—'}</td></tr>
              ))}
              {!accounts.length && <tr><td colSpan="3" className="dim">No accounts yet.</td></tr>}
            </tbody>
          </table>
        )}
      </section>
      <Authorities />
    </div>
  );
}
