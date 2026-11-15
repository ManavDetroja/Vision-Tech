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

Updated after adding the current Supabase API key format. The server API reads:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY` (`SUPABASE_ANON_KEY` remains a legacy fallback)
- `SUPABASE_SECRET_KEY` (`SUPABASE_SERVICE_ROLE_KEY` remains a legacy fallback)

For current `sb_publishable_...` and `sb_secret_...` keys, the backend sends the key in `apikey` only. Authenticated user requests add `Authorization: Bearer <user access token>`. The new secret key is never used as a user bearer token. Legacy JWT-style keys remain supported; the legacy service-role JWT is used as a service identity bearer only on server-side privileged calls.

The server API supports the newer `sb_publishable_...` / `sb_secret_...` keys and legacy aliases. The separate seed utility uses the same current secret variable and keeps its legacy service-role JWT bearer behavior isolated to legacy JWT credentials.

### Safe compatibility approach

1. For new staging setup, use `SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` from the staging project. Keep the secret key only in the private server environment.
2. API requests send either key in `apikey`; authenticated-user requests send the user's access token separately in `Authorization`. A missing secret key never falls back to the publishable key.
3. Use `node --env-file=.env scripts/check-staging-env.mjs` to check presence and format without printing values or making network requests.

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

The root `.env.example` contains placeholders only. The current worktree has no `.env` file, and the remote `main` history was scanned for service-role JWTs, new `sb_secret_` keys, common provider tokens, private-key blocks, credential assignments, database URIs, and tracked real environment files. No real credential was detected; one angle-bracket placeholder in `docs/DEPLOYMENT.md` is not a credential. No matched values were printed. Browser sources contain no secret key references.

## Remaining setup requirements

- Start/repair Docker Desktop so `docker info` consistently reports a running engine.
- Run a local Supabase start and confirm the CLI lists all migration files. Then run the 21 pgTAP assertions against that disposable local database and record actual output.
- Create a dedicated staging Supabase project. The project ref, database password, and API credentials are not configured here.
- Inspect staging's `supabase_migrations.schema_migrations` and schema before any remote apply. Migration compatibility/history is not currently confirmed.
- Decide whether staging will temporarily use legacy JWT keys or the API will be updated for the newer `apikey`-only publishable/secret key flow.
- Run real HTTP authorization checks against staging only after the API is configured with private credentials.

## Current status

Local CLI invocation and config initialization are ready. Local database readiness is **not complete** while Docker is unavailable, migration-prefix compatibility is **not confirmed**, and staging remains **blocked**. No production configuration, migrations, or administrator accounts were changed.
