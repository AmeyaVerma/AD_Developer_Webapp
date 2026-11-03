// Login. With Supabase keys configured (.env.local) this is a real server-checked login: the session and the
// role come from Supabase, and the database rules (supabase/schema.sql) decide what each person can read.
// Without keys it runs a browser-only DEMO login so the roles can still be shown — that mode is not secure.
import { useSyncExternalStore } from 'react';
import { SUPABASE_ON, supabase } from './supabase';

const KEY = 'ab_session_v1';

export const AGENTS = ['A', 'B', 'J', 'P'];
export const DEMO_MODE = !SUPABASE_ON;
export const DEMO_ACCOUNTS = { 'admin@demo.local': 'admin', ...Object.fromEntries(AGENTS.map((a) => [`${a.toLowerCase()}@demo.local`, a])) };
export const DEMO_PASSWORD = 'demo1234';

let state = { ready: DEMO_MODE, id: null, email: null, recovery: false };
const subs = new Set();
const set = (patch) => { state = { ...state, ...patch }; subs.forEach((f) => f()); };

if (DEMO_MODE) {
  try { const v = localStorage.getItem(KEY); if (v === 'admin' || AGENTS.includes(v)) state = { ...state, id: v, email: Object.keys(DEMO_ACCOUNTS).find((e) => DEMO_ACCOUNTS[e] === v) }; } catch (e) { /* ignore */ }
} else {
  const loadProfile = async (session) => {
    if (!session) { set({ ready: true, id: null, email: null }); return; }
    const { data, error } = await supabase.from('profiles').select('role, agent_code, email').eq('id', session.user.id).maybeSingle();
    if (error || !data) { await supabase.auth.signOut(); set({ ready: true, id: null, email: null, noProfile: true }); return; }
    set({ ready: true, id: data.role === 'admin' ? 'admin' : data.agent_code, email: data.email, noProfile: false });
  };
  supabase.auth.getSession().then(({ data }) => loadProfile(data.session));
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') set({ recovery: true });
    // defer: Supabase asks callbacks not to call its API synchronously
    setTimeout(() => loadProfile(session), 0);
  });
}

/** Resolves to null on success, or a message to show the user. */
export async function login(email, password) {
  const em = String(email || '').trim().toLowerCase();
  if (!em || !password) return 'Enter your email and password.';
  if (DEMO_MODE) {
    const id = DEMO_ACCOUNTS[em];
    if (!id || password !== DEMO_PASSWORD) return 'Email or password is wrong.';
    try { localStorage.setItem(KEY, id); } catch (e) { /* ignore */ }
    set({ id, email: em });
    return null;
  }
  const { error } = await supabase.auth.signInWithPassword({ email: em, password });
  if (!error) return null;
  // one message for "no such user" and "wrong password", so the form never reveals which emails exist
  return /rate|too many/i.test(error.message) ? 'Too many attempts. Wait a minute and try again.' : 'Email or password is wrong.';
}

export async function logout() {
  if (DEMO_MODE) { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } set({ id: null, email: null }); return; }
  await supabase.auth.signOut();
}

export async function sendReset(email) {
  const em = String(email || '').trim().toLowerCase();
  if (!em) return 'Enter your email first.';
  if (DEMO_MODE) return 'Password reset works once the real login is connected.';
  const { error } = await supabase.auth.resetPasswordForEmail(em, { redirectTo: window.location.origin });
  return error ? 'Could not send the email. Try again shortly.' : null;
}

export async function setNewPassword(password) {
  if (String(password).length < 8) return 'Use at least 8 characters.';
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return error.message;
  set({ recovery: false });
  return null;
}

export function useAuth() {
  const s = useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => state);
  return { ...s, loggedIn: !!s.id, isAdmin: s.id === 'admin', agent: s.id && s.id !== 'admin' ? s.id : null };
}

/** Admin sees everything; an agent sees only the properties assigned to them. */
export const canSee = (p, id) => id === 'admin' || (!!id && p.agent === id);
