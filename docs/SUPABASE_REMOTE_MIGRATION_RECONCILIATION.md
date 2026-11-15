# Supabase Remote Migration Reconciliation

**Date:** 2026-11-13
**Project:** VisionTech-Staging (owner-confirmed URL reference)
**Scope:** Read-only investigation. No migration was applied, repaired, renamed, reset, or otherwise changed. A CLI read-only migration-list request and one read-only ledger-presence query were issued based on the owner-confirmed staging reference. The query response then exposed an ambiguous `production` environment label; no further remote request was made.

## Conclusion

**REMOTE MIGRATIONS NOT VERIFIED**

The evidence conflicts. The owner-provided `supabase migration list --remote` output shows three matched versions. However, a separate read-only query on the linked project returned `NULL` for `to_regclass('supabase_migrations.schema_migrations')`, which means the migration-history relation was absent at query time. The same CLI target banner identified `VisionTech-Staging` and also appended the environment label `production`. Because this conflicts with the staging-only boundary, remote object inspection stopped immediately. The target label must be resolved before any further remote query.

## Target identity and safety boundary

- The owner confirms that the `SUPABASE_URL` project reference matches the `VisionTech-Staging` Dashboard Reference ID.
- The local `supabase/.temp/project-ref` marker was present and matched the project reference parsed in memory from `.env`; no reference or secret value is reproduced here.
- The read-only CLI target banner showed the project name `VisionTech-Staging` and appended `production`. I cannot safely determine from this result alone whether `production` is a branch/environment classification or indicates a production target. This classification was observed only after the read-only request had completed; no further remote catalog query was made.
- No database write occurred. The only direct database query issued in this investigation used `--read-only` and checked whether the migration-history relation exists. Because the environment label is ambiguous, I cannot certify that the read-only target was non-production.

## Migration-history evidence

| Evidence | Result | Interpretation |
|---|---|---|
| Owner-provided `npx supabase migration list --remote` table | Versions `202611120001`, `202611120002`, and `20261112170000` were reported matched | Owner-provided CLI evidence; target context for that run is not independently captured in this report. |
| Read-only SQL: `select to_regclass('supabase_migrations.schema_migrations')` | `NULL` | The relation was absent on the project selected by the read-only CLI query at that time. |
| Earlier owner-provided SQL Editor query | Error `42P01` for `supabase_migrations.schema_migrations` | Consistent with an absent relation at that earlier query time. |
| Independent `migration list` attempt during this investigation | CLI process exited successfully, but the PowerShell JSON wrapper could not parse/capture its response rows | Not usable as independent version-row evidence; no retry was made after the target banner showed `production`. |

If `migration list` and SQL query the same database at the same time, a matched remote migration history requires the CLI-managed history relation to exist. The current `NULL` result and the matched-row output cannot both describe the same relation state at the same time. Plausible causes include a different project/branch/connection target for one of the observations, a change between observation times, or a CLI output capture/interpretation issue. Available evidence does not establish which explanation is correct.

## Remote object inventory

Remote inspection stopped after the target label conflict. Therefore, this report does **not** claim an independently verified current catalog inventory.

| Object area | Expected after all three migrations, from local SQL/local test | Available remote evidence | Reconciliation |
|---|---|---|---|
| Public application tables | 10: `profiles`, `enquiries`, `enquiry_notes`, `admin_notifications`, `email_outbox`, `admin_activity`, `submission_rate_limits`, `products`, `service_content`, `site_settings` | Owner reports the public application-table query returned no rows. No new inventory query was run after the target label conflict. | **Mismatch / not independently current** |
| Public RLS-enabled tables | All 10 application tables | Owner reports the public RLS-table query returned no rows. | **Mismatch / not independently current** |
| Public RLS policies | 10 policies across those tables | Not queried in this investigation. | **Unknown** |
| Public functions | 21 functions after the full local chain | Not queried in this investigation. | **Unknown** |
| Public indexes | 22 indexes in the local test catalog | Not queried in this investigation. | **Unknown** |
| Triggers | Three non-internal triggers in local test, including `auth_user_profile_created` on managed `auth.users` | Not queried in this investigation. | **Unknown** |
| Types and sequence | Four enums and `enquiry_number_seq` | Not queried in this investigation. | **Unknown** |
| Extension | `pgcrypto` installed if absent | Not queried in this investigation. | **Unknown** |
| Supabase-managed schemas | Existing Supabase Auth and other managed objects are expected dependencies; migrations do not establish that all managed schemas are empty | No full managed-schema inventory was run. | **Unknown** |

The owner's empty-public-table result does not prove that `auth`, `storage`, `extensions`, or other managed schemas are empty, nor that no user-defined public types, functions, triggers, or extensions exist.

## Local migration evidence

The disposable local test report records that the three original migration files executed in order on a local Supabase CLI 3.1.0 stack, creating 10 public tables with RLS, 10 policies, 22 indexes, 21 public functions, and three triggers. It also records that the corrected local pgTAP suite passed 21/21. This is local evidence only; it does not prove that any SQL ran on the remote project.

The original migration files remain unchanged. No remote migration apply or repair command was executed during this investigation.

## Why remote application is not established

There is no reliable reconciliation between the CLI's matched rows and the reported absent history table, and the CLI target classification conflicts with the staging-only restriction. In addition, the prior public object baseline says no application tables or RLS tables exist, whereas successful execution of all three migrations should create ten such tables with RLS. The evidence therefore does not establish that the three migrations are genuinely applied to the intended staging database.

## Recommended next steps

1. Stop all CLI and SQL access until the project owner resolves why the CLI target banner appends `production`. Confirm that the exact target is a non-production staging database; if the CLI is targeting production, do not use it for this work.
2. Once the target is confirmed staging-only, capture the target name/reference and branch/environment shown by the CLI without exposing credentials.
3. Run a single read-only reconciliation session against that explicit staging reference: `migration list`, `to_regclass`, ledger versions if present, public tables/RLS, policies, functions, indexes, triggers, types, sequence, and relevant extension metadata.
4. Compare outputs from the same target/session. If the ledger is absent but local objects are present, stop and investigate manual schema changes; do not use `migration repair` or create tracking tables manually.
5. Only after the ledger and object inventory agree should a separate migration approval be considered. Do not run `db push` as part of this reconciliation.

## Actions not performed

- No migration push, repair, reset, rename, or database-object write.
- No admin account or user creation.
- No production write. The target classification conflict was discovered after the read-only request; remote inspection stopped immediately afterward.
- No secret value was printed or copied into this report.
