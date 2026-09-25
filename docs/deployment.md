# Deployment

God Workbench is a static Vite app. Deploy the generated `dist/` directory to Aliyun ECS, Tencent Cloud static hosting, or another static hosting provider.

## Supabase

Cloud autosave uses the `Glimmer` Supabase project:

- Project URL: `https://pwbbimvwfrpljjjdzmbn.supabase.co`
- Private draft table: `public.god_workbench_states`
- Public archive table: `public.god_workbench_public_archives`
- Shared member roster table: `public.god_workbench_member_rosters`
- Draft access model: logged-in users can read and update only their own workbench row
- Public archive access model: everyone can read; logged-in users can publish; frontend cannot update or delete public archives
- Shared member roster access model: everyone can read; logged-in non-anonymous users can create and update; frontend cannot delete the roster

Required environment variables:

```bash
VITE_SUPABASE_URL=https://pwbbimvwfrpljjjdzmbn.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_nmamNaOfvCIgJH_0X5oYfg_fr-iv5Q7
VITE_GOD_WORKBENCH_DOCUMENT_ID=default
```

The publishable key is safe for browser use. Do not put a Supabase `service_role` or secret key in static hosting environment variables.

## Hosting

Production is on Vercel: https://god-workbench.vercel.app . The Vercel project is linked to the GitHub repo, so every push to `main` redeploys production. The three `VITE_*` variables above are set in the Vercel project for Production and Preview.

## Accounts

Each weekly god signs up with a nickname (花名) and a password; there is no email and no confirmation. The `god-workbench-signup` Edge Function (`supabase/functions/god-workbench-signup`) creates the user with the service role, already confirmed, under a synthetic address `gw-<hex of lowercased name>@users.god-workbench.local` that is never mailed; the client then signs in with the same derived address. The derivation lives in both the function and `cloud.js` and must stay identical.

Email confirmation stays on at the project level on purpose: the Glimmer Supabase project also hosts other apps, and that switch is project-wide.

Deploy the function:

```bash
supabase functions deploy god-workbench-signup --project-ref pwbbimvwfrpljjjdzmbn --no-verify-jwt --use-api
```

A nickname account that forgets its password can only be reset from the Supabase dashboard.

Only the admin account (user id in `ROSTER_ADMIN_USER_IDS` in `cloud.js` and in the roster RLS migration) can create or update the shared member roster. Other accounts see it read-only.

## Build

```bash
npm install
npm run check
npm run build
```

Upload `dist/` to the static hosting target.

## Local Start

```bash
npm run dev
```

`npm run dev` runs `scripts/preflight.mjs` first. It checks Node.js version, installed dependencies, and whether port `43174` is available.

## Desktop Launcher

The desktop app is located at:

```text
/Users/yuchao/Desktop/上帝工作台.app
```

Its source script is:

```text
scripts/desktop-launcher.applescript
```

After editing the script, rebuild the desktop app:

```bash
osacompile -o ~/Desktop/上帝工作台.app/Contents/Resources/Scripts/main.scpt scripts/desktop-launcher.applescript
```

The launcher starts the local Vite server through `launchctl`, injects the Glimmer Supabase environment variables, and reuses the existing server when port `43174` is already serving God Workbench.
