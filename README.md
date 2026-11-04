# AB Developers — land & property tracker

React + Vite web app for tracking Maharashtra land (7/12 records): property register, 7/12 authentication,
cadastral map, MOU documents, agents and Admin roles. Backend: Supabase (login, database, private file storage, server functions).

## Run it
```bash
npm install
cp .env.example .env.local      # fill in your Supabase URL and anon key (Project Settings -> API)
npm run dev
```
Without the two keys the app starts in demo mode (browser-only login, for showing the roles — not secure).

## Backend (Supabase)
1. Run `supabase/migrations/001…008` in order in the SQL editor.
2. Turn off public sign-ups (Authentication -> Sign In / Providers).
3. Deploy the functions in `supabase/functions/` (`create-user`, `verify-712` — the latter stores uploaded 7/12 files; it no longer checks signatures).
4. Create the first Admin (see the end of `001`), then add agents from Settings in the app.

## Security notes
- Never put the Supabase `service_role` key in the app or in this repo. It lives only inside the server functions.
- `.env.local` is git-ignored. The anon key is public by design; the row-level security in `supabase/migrations` is what protects the data.

## Mahabhulekh fill-in helper
The satbara site needs a mobile number and a captcha, so it cannot be pulled automatically. The `extension/` folder is a small Chrome/Edge helper that fills the form (district, taluka, village, the agent's own mobile number) so the agent only types the captcha. See `extension/README.md`.
