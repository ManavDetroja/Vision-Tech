# Supabase Staging Setup

**Updated:** 2026-11-13  
**Status:** Waiting for the business owner to create a dedicated staging project. No Supabase project has been created, linked, or contacted from this workspace.

## Environment inventory (2026-11-13)

| Requirement | Result | Notes |
|---|---|---|
| Node.js | Available: v24.14.1 | Satisfies the current CLI's Node 20+ requirement when using `npx`. |
| npm | Available: v11.11.0 | Present, but no npm CLI dependency was added to this static site. |
| Supabase CLI | Available through `npx`: 3.1.0 | Not installed globally or as a project dependency. A local migration-list attempt could not connect because the local Postgres service was stopped. |
| Docker CLI / engine | CLI available: 29.6.2; engine unavailable on latest check | The Docker named pipe was missing during the latest `docker ps`; no Supabase containers were running. |
| `psql` | Missing | Optional for this workflow; Supabase CLI and Dashboard SQL editor are alternatives. |
| `supabase/config.toml` | Created locally with CLI 3.1.0 | `supabase init` added the missing config and `.gitignore` without changing migrations/tests. The local config disables signup and seeding. It does not identify or link a hosted project. |
| Project credentials / `.env*` files | Not present | No Supabase URL/key environment variables were found by name; no secret values were read. |

## Windows setup guide

### 1. Create a separate staging project

1. Sign in to the Supabase Dashboard using the business-controlled organization.
2. Choose **New project** and name it clearly, such as **VisionTech Staging**. Confirm the organization and project name indicate staging; do not select or alter the production project.
3. Select a region appropriate for the intended users and business operations.
4. Generate a unique database password and save it in a reputable password manager. Do not reuse a website, email, or Windows password. Do not send it in chat or put it in this repository.
5. Create the project and wait until its database/API status is ready. Keep public signup disabled for this admin-only project until a reviewed onboarding flow exists.

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

The current `services/admin-api.mjs` expects the legacy JWT key names `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`, along with `SUPABASE_URL`, `APP_ORIGIN`, `SESSION_ENCRYPTION_KEY`, and `RATE_LIMIT_HASH_SECRET`. It also optionally reads the email settings documented in the migration guide. Do not substitute a newer `sb_secret_...` value into the service-role variable without first updating and testing API authentication: this implementation currently sends the configured key in both `apikey` and `Authorization: Bearer` headers. Supabase's current API-key guidance distinguishes publishable keys from elevated secret keys and says elevated keys bypass RLS. Resolve this compatibility before API staging tests.

Only the URL and public publishable/anon key may be used in browser code where explicitly needed. The service-role/secret key is backend-only and must never be pasted into chat, a source file, HTML, JavaScript, or a public environment variable.

### 5. Configure local API secrets safely

- Prefer the hosting provider's secret manager for a deployed test API.
- For local PowerShell testing, use a private ignored `.env.local` file with filesystem access restricted to the Windows account. The API reads `process.env`; it does not automatically load `.env.local`. With the installed Node v24 runtime, launch explicitly with `node --env-file=.env.local services/admin-api.mjs` after the file has been created locally.
- Never use a command that prints environment values. Verify only that required variable names are set or `/api/health` reports missing names; redact output before saving logs.
- `.gitignore` now excludes `.env`, `.env.*`, Supabase CLI local state, and local npm artifacts, with `.env.example` allowed as a non-secret template. Verify `git check-ignore` before placing secrets in any local env file. Do not create a file containing actual credentials in this task.

## Handoff required before remote work

After creating the project, tell Codex only that the **staging** project is ready and provide its non-secret project reference if necessary. Do not send database passwords or API keys in chat. Configure credentials directly in the private local environment or hosting secret manager. Then the next run can inspect the remote migration ledger, verify that the project reference is staging, and run a dry-run before applying anything.

## Current stop point

No project exists/configuration is available in this workspace, so remote migration inspection and all live database/API tests are blocked. Do not run `supabase link`, `supabase db push`, `supabase migration repair`, or any reset until the staging identity and history are confirmed.

See the official [Supabase CLI setup guide](https://supabase.com/docs/guides/local-development/cli/getting-started), [API keys guide](https://supabase.com/docs/guides/getting-started/api-keys), and [migration deployment guide](https://supabase.com/docs/guides/deployment/database-migrations).
