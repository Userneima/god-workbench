# Deployment

God Workbench is a static Vite app. Deploy the generated `dist/` directory to Tencent Cloud static hosting.

## Supabase

Cloud autosave uses the `Glimmer` Supabase project:

- Project URL: `https://pwbbimvwfrpljjjdzmbn.supabase.co`
- Table: `public.god_workbench_states`
- Access model: logged-in users can read and update only their own workbench row

Required environment variables:

```bash
VITE_SUPABASE_URL=https://pwbbimvwfrpljjjdzmbn.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_nmamNaOfvCIgJH_0X5oYfg_fr-iv5Q7
VITE_GOD_WORKBENCH_DOCUMENT_ID=default
```

The publishable key is safe for browser use. Do not put a Supabase `service_role` or secret key in Tencent Cloud static hosting environment variables.

## Build

```bash
npm install
npm run check
npm run build
```

Upload `dist/` to Tencent Cloud static hosting.

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
