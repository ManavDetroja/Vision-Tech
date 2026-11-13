# Supabase Staging Verification

**Status:** **BLOCKED — staging project not configured.**  
**Checked:** 2026-11-13

## Configuration and project status

| Check | Result |
|---|---|
| Dedicated Supabase staging project | Not provided; no project name/ref available |
| Production project | Not accessed or modified |
| Supabase credentials | Not configured; secret values were not read |
| Supabase CLI | Version 3.1.0 runs through `npx`; not installed globally or as a project dependency |
| CLI configuration | Local `supabase/config.toml` created/reviewed; not linked to a hosted project |
| Docker/local database | Docker CLI 29.6.2; engine unavailable on latest check; local DB not running |
| PostgreSQL client | `psql` missing |
| API health / live HTTP authorization | Not testable against Supabase without staging configuration |

No remote connection, project creation, Auth account provisioning, SQL apply, migration repair, reset, or API request to a Supabase backend was performed. A local `migration list` attempt failed at PostgreSQL connection (`127.0.0.1:54322`, `ECONNREFUSED`); a local stack start did not complete and was stopped without Supabase containers running.

## Migration status

The local migration directory contains the three files listed in [SUPABASE_MIGRATION_HISTORY.md](SUPABASE_MIGRATION_HISTORY.md). The local SQL was inspected for ordering and destructive migration-time DDL. The first two filenames use noncanonical 12-digit prefixes; CLI 3.1.0 compatibility is still unconfirmed because local Postgres was unavailable. Staging history and resulting schema remain unknown. **Migrations applied: 0 confirmed.**

## Schema and RLS verification

No database catalog was queried. The existence of tables, indexes, functions, triggers, grants, and RLS policies on staging is unverified. Local SQL definitions are preparation only. RLS is not marked verified.

## pgTAP and API tests

- pgTAP assertions prepared: 21.
- pgTAP assertions executed: 0.
- Passed: 0.
- Failed: 0.
- Blocked/not run: 21.
- Real HTTP API authorization cases executed against staging: 0.

The detailed prepared-test mapping is in [SUPABASE_RLS_TEST_RESULTS.md](SUPABASE_RLS_TEST_RESULTS.md). HTTP checks for unauthenticated, invalid-token, Staff, Admin, Super Admin, cross-assignment, role-change, and product-write cases must wait until a staging API and its private credentials are configured.

## Next action required

Create the dedicated staging project and configure CLI/API credentials privately using [SUPABASE_STAGING_SETUP.md](SUPABASE_STAGING_SETUP.md). Do not send keys or database passwords in chat. Then continue by reviewing the staging migration ledger before any apply, confirming it is staging, running a dry-run, applying only the expected pending migrations, and executing the pgTAP and real HTTP authorization tests.

Staging is **not verified or ready** for P0-03 admin bootstrap or public enquiry connection.
