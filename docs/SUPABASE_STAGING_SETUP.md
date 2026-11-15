# Supabase Staging Setup

**Updated:** 2026-11-13  
**Status:** The business owner reports that `VisionTech-Staging` exists and Docker Desktop is running. Neither status nor project identity was independently checked during this credential-preparation task; this workspace did not connect to Supabase.

## Environment inventory (2026-11-13)

| Requirement | Result | Notes |
|---|---|---|
| Node.js | Available: v24.14.1 | Satisfies the current CLI's Node 20+ requirement when using `npx`. |
| npm | Available: v11.11.0 | Present, but no npm CLI dependency was added to this static site. |
| Supabase CLI | Available through `npx`: 3.1.0 | Not installed globally or as a project dependency. A local migration-list attempt could not connect because the local Postgres service was stopped. |
| Docker CLI / engine | Owner reports Docker Desktop running; not rechecked in this task | No Supabase containers were started. |
| `psql` | Missing | Optional for this workflow; Supabase CLI and Dashboard SQL editor are alternatives. |
| `supabase/config.toml` | Created locally with CLI 3.1.0 | `supabase init` added the missing config and `.gitignore` without changing migrations/tests. The local config disables signup and seeding. It does not identify or link a hosted project. |
| Project credentials / `.env*` files | Not configured in this workspace | The owner reports obtaining staging URL, publishable key and secret key; values were not shared or read. |

## Windows setup guide

### 1. Verify the staging project identity

1. Sign in to the Supabase Dashboard using the business-controlled organization.
2. Open the existing project named `VisionTech-Staging` and verify its project reference and URL are the staging project, not production.
3. Confirm the project reports ready. Do not create another project as part of this setup.
4. Keep the database password in a password manager; do not send it in chat or put it in this repository.
5. Keep public signup disabled until a reviewed onboarding flow exists.

### 2. Install tools locally

The CLI is currently runnable through `npx --yes supabase@3.1.0`. It can be installed persistently using the official Windows-supported route. The official guide supports a global Scoop package or a project-scoped npm dependency. For this static website, use the global CLI route to avoid adding package/build tooling to the website:

1. If Scoop is not installed, follow the current installation instructions on the [official Scoop site](https://scoop.sh/), then open a fresh PowerShell terminal.
2. Run `scoop install supabase`.
3. Confirm with `supabase --version` and `supabase --help`.

Alternatively, after deciding to track a project-level CLI package, the official Supabase CLI guide supports `npm install supabase --save-dev` and `npx supabase --help`. This adds `package.json`/lockfile state and is not necessary for the existing frontend.

For a local disposable database, install/start Docker Desktop for Windows, then confirm `docker info` reports a server. Docker is not needed to manually use the hosted Dashboard, but local `supabase start`/`supabase test db` needs a running compatible container engine. `psql` is optional; if needed, install only PostgreSQL command-line tools from the official PostgreSQL distribution rather than a second server. The Dashboard SQL editor can be used for read-only inspection when the owner is signed in.

### 3. Local CLI configuration

The repository now has a `supabase/config.toml` created by the CLI and reviewed locally. Its project ID is a local label only; it is not a cloud project reference. It enables the local API while disabling public Auth signup and seed loading. The CLI also created `supabase/.gitignore`; existing migration and test contents were preserved. No login or project link was performed.

### 4. Retrieve only needed API values

In the staging project's Dashboard, open **Connect** for its URL and publishable key, or **Settings → API Keys** to review available key types. Keep the public API URL and publishable/legacy anon key distinct from server-only keys.

`services/admin-api.mjs` now accepts `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY`. It sends API keys in `apikey`; for signed-in users, `Authorization: Bearer` carries the user's Supabase Auth access token. It does not send a new `sb_secret_...` key as a bearer token. Legacy `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` aliases remain supported. Email settings are optional and documented in the migration guide.

Only the URL and public publishable/anon key may be used in browser code where explicitly needed. The service-role/secret key is backend-only and must never be pasted into chat, a source file, HTML, JavaScript, or a public environment variable.

### 5. Configure local API secrets safely

- Prefer the hosting provider's secret manager for a deployed test API.
- For local PowerShell testing, use the ignored root `.env` file (`C:\Vision Tech\.env`). The API reads `process.env`; it does not automatically load `.env`. With Node v24, start from the project root using `node --env-file=.env services/admin-api.mjs`.
- Never use a command that prints environment values. Verify only that required variable names are set or `/api/health` reports missing names; redact output before saving logs.
- `.gitignore` excludes `.env` and `.env.*` while allowing `.env.example` as a placeholder-only template. Verify `git check-ignore` before saving credentials. `node --env-file=.env scripts/check-staging-env.mjs` checks variable presence/format only and makes no network request.

## Next staging verification step

The owner reports the staging project exists. Configure credentials locally and run the no-network checker first. If it passes, verify the non-secret project reference and migration ledger before any migration work. Do not send database passwords or API keys in chat.

## Current stop point

No credentials are configured in this workspace, so the project identity, migration ledger, and live API are not verified. No remote connection or migration was performed. Do not run `supabase link`, `supabase db push`, `supabase migration repair`, or any reset until the staging identity and history are confirmed.

See the official [Supabase CLI setup guide](https://supabase.com/docs/guides/local-development/cli/getting-started), [API keys guide](https://supabase.com/docs/guides/getting-started/api-keys), and [migration deployment guide](https://supabase.com/docs/guides/deployment/database-migrations).
