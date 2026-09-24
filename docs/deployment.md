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

## Auth Email

Registration and login use Supabase Auth. The app does not implement its own verification-code system.

Use email confirmation links for the first implementation. For production, configure Auth Site URL, Redirect URLs, email templates, and Custom SMTP before opening registration to real users.

Detailed checklist: `docs/auth-email.md`.

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
