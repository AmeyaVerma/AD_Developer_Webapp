import { useState } from 'react';
import { DEMO_MODE, DEMO_PASSWORD, login, sendReset, setNewPassword, useAuth } from './auth';

// Switch on once the site is hosted (Vercel) and its address is set in Supabase -> Authentication -> URL Configuration.
const SHOW_FORGOT = false;

const Mark = () => (
  <svg viewBox="0 0 32 32" width="40" height="40" aria-hidden="true">
    <rect width="32" height="32" rx="10" fill="rgba(255,255,255,0.14)" />
    <g fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round">
      <path d="M4 23c4-1 5-7 10-7s5 6 10 5 4-5 4-5" />
      <path d="M4 17c4-1 5-7 10-7s5 6 10 5" />
      <path d="M4 11c5-1 5-6 10-6" />
    </g>
  </svg>
);

export default function Login() {
  const { recovery, noProfile } = useAuth();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ kind: '', text: '' });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg({ kind: '', text: '' });
    const err = recovery ? await setNewPassword(pw) : await login(email, pw);
    setBusy(false);
    if (err) { setMsg({ kind: 'err', text: err }); setPw(''); }
  };
  const forgot = async () => {
    const err = await sendReset(email);
    setMsg(err ? { kind: 'err', text: err } : { kind: 'ok', text: 'If that email has an account, a reset link is on its way.' });
  };

  return (
    <div className="lg">
      <aside className="lg-side">
        <div className="lg-brand"><Mark /><b>AB Developers</b></div>
        <div>
          <h2>Land &amp; property,<br />in one register.</h2>
          <p>7/12 records, plot boundaries on satellite maps and every property&rsquo;s paperwork — for the team that sells them.</p>
        </div>
        <small>Authorised users only.</small>
      </aside>

      <main className="lg-main">
        <form className="lg-form" onSubmit={submit} noValidate>
          <h1>{recovery ? 'Set a new password' : 'Welcome back'}</h1>
          <p className="dim">{recovery ? 'Choose a new password for your account.' : 'Log in to continue.'}</p>

          {DEMO_MODE && !recovery && (
            <div className="lg-demo" role="note">
              <b>Demo mode</b> — not connected to a server yet. Use <code>admin@demo.local</code> or <code>a@demo.local</code> (also b, j, p) with password <code>{DEMO_PASSWORD}</code>.
            </div>
          )}
          {noProfile && <div className="lg-err" role="alert">This account has no access yet. Ask the Admin to add you.</div>}

          {!recovery && (
            <label>Email
              <input type="email" autoComplete="username" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
            </label>
          )}
          <label>{recovery ? 'New password' : 'Password'}
            <span className="lg-pw">
              <input type={show ? 'text' : 'password'} autoComplete={recovery ? 'new-password' : 'current-password'} value={pw} onChange={(e) => setPw(e.target.value)} />
              <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? 'Hide' : 'Show'}</button>
            </span>
          </label>

          {msg.text && <p className={msg.kind === 'ok' ? 'lg-ok' : 'lg-err'} role="alert">{msg.text}</p>}

          <button className="btn lg-go" disabled={busy}>{busy ? 'Please wait…' : recovery ? 'Save password' : 'Log in'}</button>
          {!recovery && SHOW_FORGOT && <button type="button" className="linkbtn" onClick={forgot}>Forgot password?</button>}
        </form>
      </main>
    </div>
  );
}
