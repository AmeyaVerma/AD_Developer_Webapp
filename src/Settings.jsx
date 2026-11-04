import { useCallback, useEffect, useState } from 'react';
import { AGENTS, DEMO_MODE, refreshProfile } from './auth';
import { supabase } from './supabase';
import { actions } from './store';

const EMPTY = { email: '', password: '', role: 'agent', agent: '' };


/** One mobile number per login — the person's own. The fill-in helper puts it on the satbara site. */
function PhoneCell({ account, onSaved }) {
  const [v, setV] = useState(account.phone || '');
  const [state, setState] = useState('');
  const dirty = v !== (account.phone || '');
  const save = async () => {
    const digits = v.replace(/\s+/g, '');
    if (digits && !/^\d{10}$/.test(digits)) { setState('10 digits'); return; }
    const { error } = await supabase.from('profiles').update({ phone: digits || null }).eq('email', account.email);
    setState(error ? 'not saved' : 'saved');
    if (!error) onSaved();
  };
  return (
    <span className="phonecell">
      <input value={v} inputMode="numeric" placeholder="10 digits" onChange={(e) => { setV(e.target.value); setState(''); }} aria-label={`Mobile number for ${account.email}`} />
      {dirty && <button type="button" className="btn ghost sm" onClick={save}>Save</button>}
      {state && <small className="dim"> {state}</small>}
    </span>
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
    const { data, error } = await supabase.from('profiles').select('email, role, agent_code, phone, created_at').order('created_at');
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
            <thead><tr><th>Email</th><th>Role</th><th>Agent</th><th>Mobile (for the satbara site)</th></tr></thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.email}><td>{a.email}</td><td>{a.role === 'admin' ? 'Admin' : 'Agent'}</td><td>{a.agent_code || '—'}</td><td><PhoneCell account={a} onSaved={() => { load(); refreshProfile(); }} /></td></tr>
              ))}
              {!accounts.length && <tr><td colSpan="4" className="dim">No accounts yet.</td></tr>}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
