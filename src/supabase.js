import { createClient } from '@supabase/supabase-js';

// Keys come from .env.local (see .env.example). The anon key is public by design; what protects the data is the
// row-level security written in supabase/schema.sql. Never put the service_role key in this app.
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const SUPABASE_URL = url;
export const SUPABASE_ANON_KEY = key;

export const SUPABASE_ON = Boolean(url && key);
export const supabase = SUPABASE_ON ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } }) : null;
