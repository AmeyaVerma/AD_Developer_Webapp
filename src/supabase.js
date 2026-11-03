import { createClient } from '@supabase/supabase-js';

// Keys come from .env.local (see .env.example). The anon key is public by design; what protects the data is the
// row-level security written in supabase/schema.sql. Never put the service_role key in this app.
// Environment variables win; the defaults are this project's PUBLIC address and publishable key (both are meant to be public —
// the row-level security in supabase/migrations is what protects the data), so a host that forgets to set them still works.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://dzzrrkmbdqumlgjyxopq.supabase.co';
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_gUyeHiqPFgGOE2Pp9JRVog_UFoj5gb4';
export const SUPABASE_URL = url;
export const SUPABASE_ANON_KEY = key;

export const SUPABASE_ON = Boolean(url && key);
export const supabase = SUPABASE_ON ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } }) : null;
