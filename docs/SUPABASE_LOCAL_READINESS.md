# Supabase Local Readiness

**Checked:** 2026-11-13  
**Scope:** Local tooling/configuration only. No production project was accessed and no remote migration was applied.

## CLI and Docker status

| Check | Result | Evidence |
|---|---|---|
| Supabase CLI | **Available through `npx`, not installed globally or as a project dependency** | `npx --yes supabase@3.1.0 --version` returned `3.1.0`. No Supabase dependency was added to the website. |
| Node.js / npm | Available | Node.js `v24.14.1`; npm `11.11.0`. |
| Docker CLI | Available | `docker --version` returned `29.6.2`. |
| Docker engine | **Unavailable on the latest check** | `docker ps` returned `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine ... The system cannot find the file specified.` An earlier check in this turn briefly reported Docker server `29.6.2`; the later engine check failed. No Supabase containers were present. |
| PostgreSQL client | Missing | `psql` is not installed. It is optional if the CLI local database or Dashboard SQL editor is used. |

`supabase init` was run locally because the project had a `supabase/` directory but no `config.toml`. It added `supabase/config.toml` and `supabase/.gitignore`; it did not rewrite the existing migration or test files. The generated config was adjusted locally to keep the API enabled while disabling seed loading and public Auth signup. It contains no supplied staging URL/key or database password. No Auth users are seeded.

The CLI command `npx --yes supabase@3.1.0 migration list` loaded the local target (`127.0.0.1:54322`) but failed because its Postgres service was not running (`ECONNREFUSED`). A local `supabase start` attempt did not complete; it was stopped after waiting without Supabase containers appearing. Consequently, the local DB, migration application, and pgTAP suite have not run.

## Migration filename compatibility

The local files are:

| File | Prefix length | Assessment |
|---|---:|---|
| `202611120001_secure_admin.sql` | 12 digits | Does not follow the canonical 14-digit `YYYYMMDDHHmmss` naming convention. CLI 3.1.0 acceptance was not confirmed because the local database was unavailable. |
| `202611120002_enquiry_lifecycle.sql` | 12 digits | Does not follow the canonical 14-digit convention. CLI 3.1.0 acceptance was not confirmed. |
| `20261112170000_security_hardening.sql` | 14 digits | Follows the canonical timestamp shape. Its execution is unverified. |

Supabase's current examples use 14-digit timestamp prefixes and its CLI compares migration timestamps with the database ledger. The first two files therefore need a deliberate compatibility/history review before staging apply. **They were not renamed.** Renaming a migration changes its version identifier; if the original version is already recorded remotely, the renamed file can appear pending and may replay an already-applied schema change. Inspect staging history and actual schema first. If those older files are already applied, retain their names and use a reviewed forward-only migration for any correction. [Supabase CLI migration reference](https://supabase.com/docs/reference/cli/introduction), [migration history guide](https://supabase.com/docs/guides/deployment/database-migrations)

The CLI version is known, but parser/database compatibility remains **unconfirmed** until Docker/Postgres runs and a local migration listing or disposable local migration test completes.

## API key compatibility findings

The current backend in `services/admin-api.mjs` supports the legacy JWT-style variables:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

The `sb()` request helper uses the anon or service-role value in the `apikey` header **and also** places it in `Authorization: Bearer ...` when there is no user session token. The Auth invite endpoint also uses the service-role value in both headers. This is compatible with the legacy JWT-shaped keys the code was written for.

The backend does **not** implement `SUPABASE_PUBLISHABLE_KEY` or `SUPABASE_SECRET_KEY` variables. It does not support the newer `sb_publishable_...` / `sb_secret_...` key flow correctly: these are opaque API keys, not JWTs, and Supabase directs callers to send them in `apikey`, not `Authorization: Bearer`. Passing a new key as the bearer value can fail JWT verification. The public-key token-login requests happen to set only `apikey`, but ordinary public Data API requests still put the configured anon value in the bearer header; elevated server calls likewise put the secret/service value in the bearer header.

### Safe compatibility approach

1. For immediate staging validation with the existing code, use only the legacy `anon` and `service_role` JWT keys if the staging Dashboard still provides them. Keep `service_role` in the server's private environment only. Do not put it in browser code or chat.
2. Before adopting the newer API keys or using this backend for production, update the backend to read publishable/secret variables and separate the two headers: put the publishable or secret key in `apikey`; use `Authorization: Bearer <user access token>` only for authenticated user requests; do not send a new API key as a bearer token. Verify Auth invite/token flows and REST/RPC calls on staging using the documented API-key behavior.
3. During any transition, do not silently fall back from a missing secret key to a public key for privileged calls. Fail closed and report only missing variable names.

Supabase currently documents publishable keys for public components and secret keys for server components; secret keys map to the elevated `service_role` and bypass RLS. [API keys and header rules](https://supabase.com/docs/guides/getting-started/api-keys), [migration guide for new keys](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys)

## Secret handling checks

The root `.gitignore` was reviewed and `git check-ignore --no-index` produced these results:

| Path | Ignored? |
|---|---:|
| `.env` | Yes |
| `.env.local` | Yes |
| `services/.env.production` | Yes |
| `supabase/.temp/access-token` | Yes |
| `.env.example` | No — trackable |
| `services/.env.example` | No — trackable |

`git ls-files` found no tracked `.env`/`.env.*` files. A scan of browser code (`js/` and `admin/`, JS/MJS/HTML/CSS) found no occurrences of `service_role`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY`, `sb_secret_`, or secret-key references. The backend service files do refer to the server-only service role key as expected. No key values were printed or read.

## Remaining setup requirements

- Start/repair Docker Desktop so `docker info` consistently reports a running engine.
- Run a local Supabase start and confirm the CLI lists all migration files. Then run the 21 pgTAP assertions against that disposable local database and record actual output.
- Create a dedicated staging Supabase project. The project ref, database password, and API credentials are not configured here.
- Inspect staging's `supabase_migrations.schema_migrations` and schema before any remote apply. Migration compatibility/history is not currently confirmed.
- Decide whether staging will temporarily use legacy JWT keys or the API will be updated for the newer `apikey`-only publishable/secret key flow.
- Run real HTTP authorization checks against staging only after the API is configured with private credentials.

## Current status

Local CLI invocation and config initialization are ready. Local database readiness is **not complete** while Docker is unavailable, migration-prefix compatibility is **not confirmed**, and staging remains **blocked**. No production configuration, migrations, or administrator accounts were changed.
