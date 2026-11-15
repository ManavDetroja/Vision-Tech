# Supabase Staging Connection & Migration History Verification

> **Local forensic update — 2026-11-15 (supersedes dated local-state claims below).** This investigation made no remote requests. The earlier sections remain historical evidence, not a current staging snapshot. See [SUPABASE_FORENSIC_INVESTIGATION_REPORT.md](SUPABASE_FORENSIC_INVESTIGATION_REPORT.md) for source offsets, line references, complete SQL dependency map and limitations.
>
> - Current `supabase/.temp/project-ref` is present and matches the URL reference, owner-confirmed staging reference and cached metadata naming `VisionTech-Staging`. `.supabase/project-ref` is absent. The local `Vision_Tech` config label is separate. `.env` remains ignored/untracked.
> - Cached CLI 3.1.0 code emits `production` for a recognized main/default project. That label does not by itself identify business production use; exact ref and owner authorization govern targeting.
> - The CLI lists three columns: Local, Remote, Time (UTC). It handles missing history relation (42P01) as an empty remote list. An offline reproduction shows Local plus Time values exactly match the owner's transcription when Remote is blank. The transcription therefore does not prove matched remote versions; original full output remains unavailable.
> - The historical `to_regclass` result was one row containing NULL, not zero rows or a failed SELECT. That result does not establish that the entire history schema or all application objects were absent. No current remote inventory was obtained.
> - Original migrations have no Git diff. Older M2/M3 size/hash differences exactly match LF versus CRLF encoding, verified in memory without rewriting files. Local test success is historical evidence, not a fresh remote result.
> - Earlier preflight prose overstated the M1 ADMIN weakness: M1 requires a SUPER_ADMIN actor; M2 introduces the ADMIN-promotion gap; M3 tightens it. The full map also includes the previously omitted site_settings foreign key. The suite's 21 assertions do not directly test a protected SUPER_ADMIN target, and count assertions alone do not prove row identities.
> - Current decision: **TARGET IDENTITY VERIFIED, MIGRATION HISTORY UNRESOLVED**. Separately approved read-only verification must preserve all three output fields, target evidence and actual catalog definitions before considering any deployment.


**Date:** 2026-11-13
**Scope:** Verification only. No migration, SQL write, account creation, link operation, or database connection was performed.

**P0-02B baseline update:** The owner subsequently supplied read-only staging SQL results: no `supabase_migrations` schema, no application tables in `public`, no public tables returned by their RLS inspection, and no migration applied during that verification. These observations are owner-supplied and were not independently queried from this workspace.

**Migration preflight update (2026-11-13):** All three local migrations and the 21-assertion pgTAP test were inspected without contacting Supabase or executing SQL. The detailed review is in [SUPABASE_MIGRATION_PREFLIGHT_REPORT.md](SUPABASE_MIGRATION_PREFLIGHT_REPORT.md). The local sequence is M1 → M2 → M3, but execution is not recommended until mixed-width migration filename compatibility is verified locally and the managed `auth.users` trigger effect is explicitly reviewed. No files were renamed and no database state was changed.

## Results summary

| Check | Status | Evidence |
|---|---|---|
| Required local environment | **PASS** | `node --env-file=.env scripts/check-staging-env.mjs` reported all six required names present/valid and identified the current key formats as new. Values were not printed. |
| Environment loading | **PASS** | The API reads `process.env`; Node v24.14.1 loads the root file explicitly with `--env-file=.env`. The API does not auto-load `.env`. |
| `.env` protection | **PASS** | Root `.env` exists, `git check-ignore` says it is ignored, and `git ls-files --error-unmatch .env` confirms it is not tracked. `.env.example` remains trackable. Neither file was modified in this task. |
| Docker daemon | **PASS** | `docker info --format '{{.ServerVersion}}'` returned `29.9.3` with exit code 0. |
| Supabase CLI | **PASS** | `npx --yes supabase@3.1.0 --version` returned `3.1.0`. |
| Supabase Auth connectivity | **PASS** | GETs to `/auth/v1/health` and `/auth/v1/settings` at the configured Supabase URL returned HTTP 200. The settings request carried the publishable key only in `apikey`; no response body or credential was printed. |
| Dashboard identity `VisionTech-Staging` | **UNVERIFIED** | The URL uses a Supabase project domain and its publishable key is accepted, but the public health endpoint does not return the Dashboard project display name. No Supabase Management API session or linked project is configured to verify the name. The URL is treated as staging based on the owner's configuration/context, not independently confirmed by the service. |
| Remote migration history | **UNAVAILABLE** | The owner-supplied baseline says `supabase_migrations` does not exist, so there is no remote version ledger to list. A read-only migration-list query was not run from this workspace; no linked project, CLI login token, database URL, or database password is available. |
| Production database access | **PASS** | No database endpoint was contacted. The only Supabase requests were two read-only Auth GETs to the owner-designated URL. |

## Environment and backend

The private process requiring the Supabase URL and API keys is `services/admin-api.mjs`. It uses the publishable key for Auth/API identification and the secret key for server-only privileged operations. Authenticated admin calls use the signed-in user's access token as the bearer token. The new secret API key is not used as a user's bearer token. The optional `services/seed-admin-data.mjs` utility also needs the URL and server-only secret key and performs writes; it was not run.

The root `.env` was checked by the presence/format checker. No values were read into output or saved to this report. The checker is local-only and makes no network requests. Separate GET requests to Auth health and settings used the configured URL and publishable key, returned only status results to output, and did not access application tables or Postgres.

The local Supabase CLI configuration contains `project_id = "Vision_Tech"`. This is a local CLI label, not evidence of the hosted project identity. No `supabase/.temp/project-ref` or CLI auth token is present, and no `supabase link` was run.

## Local migration inventory

| Local file | Prefix digits | Local contents | Filename assessment |
|---|---:|---|---|
| `202611120001_secure_admin.sql` | 12 | Admin/profile, enquiry, notification, outbox, activity, products/services/settings schema; authorization functions; RLS, grants and policies. | Numeric, unique and ordered; 12-digit timestamp shape is noncanonical relative to current 14-digit examples. Exact CLI/remote interpretation is unverified. |
| `202611120002_enquiry_lifecycle.sql` | 12 | Enquiry lifecycle, notes, assignment/follow-up, notification/activity behavior and related policies/functions. | Numeric, unique and ordered; same 12-digit compatibility uncertainty. |
| `20261112170000_security_hardening.sql` | 14 | Adds enquiry `updated_at`, trigger, hardens `SECURITY DEFINER` search paths and tightens staff-role administration. | 14-digit timestamp shape; execution and remote status unverified. |

No migration file was renamed. Current Supabase documentation describes files as `<timestamp>_<name>.sql` and says local and remote histories are compared by timestamp; it does not establish from this inspection whether these particular 12-digit versions are accepted by this project's CLI/database. The installed CLI is 3.1.0, but no remote list was run. See the [CLI reference](https://supabase.com/docs/reference/cli/introduction) and [migration deployment guide](https://supabase.com/docs/guides/deployment/database-migrations).

## Migration reconciliation

The owner reports that the `supabase_migrations` schema is absent, so no remote migration-version rows were available in the inspected baseline. The owner also reports no migrations were applied during that verification. This does not establish whether any migration was applied manually in the past, and the baseline was not independently queried here.

| Version | Local file | Remote ledger | Reconciliation |
|---|---|---|---|
| `202611120001` | Present | No ledger schema reported | **Unrecorded; historical/manual execution not independently ruled out** |
| `202611120002` | Present | No ledger schema reported | **Unrecorded; historical/manual execution not independently ruled out** |
| `20261112170000` | Present | No ledger schema reported | **Unrecorded; historical/manual execution not independently ruled out** |

Renaming either 12-digit file before reading the remote ledger could create a new version and make an already-applied migration appear pending. Do not rename, apply, or repair any version until the exact remote ledger is reconciled.

## RLS and test readiness review

Static review found RLS enabled for profiles, enquiries, notes, notifications, email outbox, activity, rate limits, products, services, and site settings. Policies limit staff enquiry/note visibility to assigned records, notifications to their recipient, public catalogue reads to visible records, and admin reads to authorized roles. Direct table write grants are restricted; mutations are routed through functions. The final hardening migration fixes `SECURITY DEFINER` search paths and further restricts staff role changes.

The local pgTAP file `supabase/tests/001_rls_security_test.sql` declares 21 assertions and wraps synthetic fixtures in a transaction ending with `ROLLBACK`. It was inspected but not run. Runtime RLS behavior, migration compatibility, and the deployed schema remain unverified because no database was queried and no migration was applied. If the hardening migration is absent remotely, the earlier migration's less restrictive `search_path` settings remain an unresolved risk until history and schema are inspected.

## Secret and Git checks

- Root `.env` is ignored and not tracked; `.env.example` is trackable.
- The environment checker reported required variable names and validity only; it did not print values.
- No `.env` value was copied into Git-tracked files or this report.
- A current-file credential-pattern scan found no real credential. Its only assignment-shaped match was the angle-bracket placeholder in `docs/DEPLOYMENT.md`; the value was not printed.
- No database password or CLI access token was found in the environment names checked for remote migration access.
- No credential-bearing command arguments were used.

## Risks and unresolved items

1. The Supabase project display name cannot be independently verified with the available local configuration. The HTTP 200 verifies the configured endpoint/key pair responds, not its Dashboard label.
2. The migration ledger is unknown. The local 12-digit migration versions may not match the remote ledger or canonical timestamp expectations.
3. The remote schema and RLS policy state are unknown; static SQL review is not evidence that those policies are deployed or effective.
4. The 21 pgTAP assertions were not executed.

## Recommended next steps

1. In the Supabase Dashboard, verify the configured project reference belongs to `VisionTech-Staging`; compare it locally with the non-secret project reference in the configured URL. Do not share API keys or passwords.
2. To avoid adding database credentials to this workspace, use the Dashboard SQL Editor for a read-only query of `supabase_migrations.schema_migrations` and share only the returned version timestamps, or provide a secure, noninteractive CLI/database access method for the staging project.
3. Reconcile the three local timestamps against the remote ledger and inspect actual schema/RLS state. Keep all filenames unchanged until this comparison is complete.
4. Only after reconciliation, plan a separate staging-only migration/test milestone. Do not run any production command.
