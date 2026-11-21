# P0-04A — Staging recovery verification and migration integrity

Date: 2026-11-15 (Asia/Calcutta). Project: `C:\Vision Tech`.

## Decision

**Recovery readiness: READY under condition B, for the currently empty VisionTech application state.**

Current read-only evidence confirms that the application ledger and application schema are absent, there are no Auth users, and there are no Storage buckets or objects. The three original migrations are unchanged and have already initialized a disposable local Supabase environment successfully, with 21/21 pgTAP assertions passing. No existing VisionTech application rows require export.

This is not a claim that a logical backup exists, a dump was restored, or the entire hosted Supabase project can be reproduced from the three application migrations. Managed schemas, extensions, event triggers and provider configuration exist and must be preserved. This conclusion uses the explicit empty-application alternative authorized in P0-04A; it narrows the earlier P0-04 backup requirement to the actual application state. It does not authorize deployment.

| Required result | Assessment |
| --- | --- |
| Migration integrity | **VERIFIED** |
| Unexpected SQL file | **EXPLAINED** |
| Remote application data preservation | **NOT REQUIRED** at the observed empty application baseline |
| Backup | **NOT AVAILABLE** — no backup created; provider inventory empty |
| Restore procedure | **NOT TESTED** for backup restoration; historical local schema reconstruction was tested |
| Recovery readiness | **READY — condition B only** |

## p004-extra.sql investigation

Exact location:

`C:\Users\LEGION\Documents\Codex\2026-11-13\p0-02b-disposable-local-supabase-migration\p004-extra.sql`

Size: 510 bytes. SHA-256: `c9d48ebd61151185671ad228f2ff1c67dd1e09aff78249dd1953206de2246c91`.

Complete seven-line contents:

```sql
SELECT jsonb_build_object(
  'read_only',current_setting('transaction_read_only'),
  'auth_users_exists',to_regclass('auth.users') IS NOT NULL,
  'public_create_anon',has_schema_privilege('anon','public','CREATE'),
  'public_create_authenticated',has_schema_privilege('authenticated','public','CREATE'),
  'event_triggers',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',evtname,'event',evtevent,'enabled',evtenabled,'function',evtfoid::regproc::text)),'[]'::jsonb) FROM pg_event_trigger)
) AS readiness;
```

The previous P0-04 tool record shows that this file was created to check Auth prerequisite existence, public CREATE privileges, read-only transaction state and existing event triggers. It was explicitly executed through CLI `db query --remote=fszrsispjxunckknphaw --read-only --file ...`. Its contents only inspect metadata; they contain no DDL, DML or application mutation function call. The seven added lines were a new diagnostic file, not a fourth migration.

Git investigation:

- Its containing Codex workspace is outside the VisionTech repository. `git rev-parse --show-toplevel`, scoped status and scoped log there return `fatal: not a git repository (or any of the parent directories): .git`. It is therefore not merely an untracked file in the VisionTech Git working tree.
- VisionTech `git ls-files -- '*p004-extra.sql'` and `git log --all --format='%h %s' -- '*p004-extra.sql'` returned no entries.
- A recursive exact-name search of project text, excluding Git internals, dependencies and environment files, found no reference before this report was created. No migration or deployment script references it. This report now supplies the intentional documentary reference.
- It is not inside `C:\Vision Tech\supabase\migrations\`, is not discovered as a migration, and does not change deployment order or count.
- The diagnostic file was read and hashed only during P0-04A. No SQL file was deleted, renamed, moved or modified.

## Original migration integrity

Exactly three migration files remain, with unique version prefixes and this execution order:

| Order | File | Bytes | Current SHA-256 |
| --- | --- | ---: | --- |
| 1 | `202611120001_secure_admin.sql` | 33423 | `03920f5f77e1713606ed2429a3bac13e091d1cf6df5da0890b911bbc2c3664c7` |
| 2 | `202611120002_enquiry_lifecycle.sql` | 8144 | `022c87ac5e7cae89205a0c63e41b74cec3ec274a8914a006e8513f8f8dd09f7c` |
| 3 | `20261112170000_security_hardening.sql` | 5434 | `5c40e5f5c1e1c4c68d498b34e5fe1a771748bd44db660b85fa1655b7b7b50d4a` |

All hashes match `SUPABASE_STAGING_DRY_RUN_REPORT.md` and `SUPABASE_STAGING_DEPLOYMENT_READINESS.md`. M1 creates the base application objects and custom Auth trigger; M2 extends enquiry lifecycle and depends on M1; M3 applies final role/search-path hardening and depends on M1/M2. No filename normalization is needed; the original 12/14-digit sequence was tested with CLI 3.1.0.

`SUPABASE_LOCAL_MIGRATION_TEST_REPORT.md` records successful local execution of these original files, the Auth-profile trigger and duplicate-user tests, and 21/21 assertions after correcting the stale activity-count expectation. That test correction did not edit a migration. `SUPABASE_STAGING_DRY_RUN_REPORT.md` records exactly these three files in order with no application. These are prior execution results, not tests rerun in P0-04A.

## Current staging identity and preservation evidence

The linked marker exactly equals `fszrsispjxunckknphaw`. The configured SUPABASE_URL reference was independently compared in memory and matched. Each remote command used this explicit reference, and the CLI target banner named `VisionTech-Staging`. No other project was contacted. Its CLI `production` classification refers to the main/default project, not a different business production project.

The existing catalog query in the external `p004-catalog.sql` was reused without editing. It was executed with the cached CLI 3.1.0 executable and `db query --remote=fszrsispjxunckknphaw --read-only --file <existing-path>`. Additional aggregate-only SELECTs inspected schema names/owners and counted Auth users and Storage records. All queries exited 0 and reported `transaction_read_only = on`; no email addresses, Auth identities, passwords or object contents were returned.

| Check | Current result |
| --- | --- |
| Application history schema / relation | Both null: absent |
| Public tables, views, materialized views and sequences | None |
| Public columns, constraints, indexes, enums, policies | Empty arrays |
| Expected application functions | None |
| Existing public function | `rls_auto_enable`; fixed pg_catalog search path; body MD5 `c44fb229ea8a6b0afd04a0a33261c16c`, matching prior evidence |
| Public/auth.users non-internal ordinary triggers | None; no application Auth trigger yet |
| Auth users | **0** |
| Storage buckets | **0** |
| Storage objects | **0** |
| Read-only query role / server | `supabase_read_only_user` / PostgreSQL 17.11 |

The non-system schema inventory contains public, realtime, extensions, vault, graphql_public, graphql, auth and storage. Only the established Supabase/extension schemas were returned; no separate VisionTech application schema was observed. Managed ledgers and relations remain. Public has the pre-existing RLS event-trigger function even though it has no tables. No claim is made that all managed tables or Vault contents are empty; their contents were not exported or disclosed. They are outside the empty **application** reconstruction claim and are not to be reset.

With no application relations, there can be no existing profiles, enquiries, notes, products, application settings, outbox or application activity rows to preserve. A migration backfill of enquiries will affect zero existing application rows on this baseline. No Auth accounts or uploaded Storage files need copying according to the aggregate counts above.

## Backup tooling and feasibility

The authenticated backup listing was rechecked for the same staging reference. Exit 0; `walg_enabled = true`, `pitr_enabled = false`, available backups count **0**, physical backup metadata absent. A WAL-G capability flag is not a completed recovery point.

Local findings:

- `pg_dump`, `pg_restore`, `psql` and `7z` were not found on PATH. The standard `C:\Program Files\PostgreSQL` directory is absent. This does not rule out tools in other custom locations.
- Docker CLI is installed. Both daemon version and image inventory failed with: `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine; check if the path is correct and if the daemon is running: open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.` No local stack was started or reset.
- DATABASE_URL, SUPABASE_DB_URL, SUPABASE_DB_PASSWORD, PGHOST, PGSERVICE and PGPASSFILE were absent from the checked root environment configuration/process environment. Only presence booleans were reported.
- The CLI cached pooler URL exists and its username is bound to staging, but it contains no password. Default pgpass/service files checked were absent. CLI authenticated reads work; direct pg_dump authentication has not been established. CLI-managed temporary authentication may be usable without a manually configured database password, but it was not exercised for export here.
- `C:\Vision Tech Backups\` does not exist. It was not created because no backup was needed for the verified empty application state. No dump, fake backup file, or credential file was created in any directory.

Supported future logical exports can use Supabase `db dump` or PostgreSQL `pg_dump`. The default Supabase dump excludes managed schemas and omits data/custom roles unless requested; public-only export is not full-project recovery. PostgreSQL custom-format dumps can be inspected with `pg_restore --list`; full logical exports still do not reproduce provider settings or Storage object bytes. See the [Supabase CLI dump reference](https://supabase.com/docs/reference/cli/supabase-issue-feature#supabase-db-dump) and [backup guidance](https://supabase.com/docs/guides/platform/backups).

Encrypted local storage is practical once selected and verified: use a restricted encrypted destination outside Git, such as an encrypted volume or an explicitly configured encrypted archive, with a separately recoverable encryption key. Access controls alone are not encryption. No encryption tool, key recovery process or encrypted export was tested in this task. Do not put passwords in command arguments, logs, reports or the repository. Suggested future location remains `C:\Vision Tech Backups\`.

If data is added later, a backup procedure must verify successful command exit, nonzero/plausible size, format, checksum, expected schema/data/privilege coverage, and a successful isolated restore. A file-size or archive-list check alone is insufficient. Starting Docker or installing tools solely to dump an empty application schema was unnecessary under the user's condition B.

## Recovery procedure for the current application baseline

1. Preserve the three migration files, their recorded hashes, configuration documentation and current local catalogue. The migrations reconstruct database schema and default settings, not the full frontend catalogue or external email/Auth configuration. No remote catalogue rows currently exist.
2. Before any separately approved deployment, repeat the explicit staging identity, hash, migration-ledger and application-preservation checks if state has changed. Stop if users/data or unexpected application objects appear; condition B then needs reassessment and may require a verified export.
3. A fresh Supabase-managed database supplies the required Auth facilities, service roles and extensions. The unchanged M1, M2 and M3 files reconstruct the application schema in order. Prior disposable local execution verifies this route. Do not apply them to bare PostgreSQL without the required Supabase prerequisites.
4. Validate the resulting application inventory: 10 tables with RLS, 4 enums, enquiry sequence, 21 application functions, 22 indexes, 11 foreign keys, 10 policies and 3 ordinary triggers. Inspect definitions/ACLs rather than using counts alone. Preserve unrelated hosted functions/event triggers. Validate the custom Auth trigger and final staff-role restrictions before access activation.
5. If a future deployment fails partway, stop and inspect its ledger and actual objects read-only. Do not blindly replay, manually repair the ledger, delete objects or reset the existing remote project. A separately reviewed forward fix may be needed. A separately authorized fresh disposable/staging Supabase environment can reconstruct the application from the same files; new project endpoints/credentials would require separate configuration and approval. No such environment was created here.
6. The empty-state reconstruction option provides no automatic in-place undo for changes to the existing project's managed objects. Retain the managed baseline, avoid destructive remote operations, and require an explicit recovery plan/approval if a failed migration affects managed Auth behavior. Once live data exists, replace this empty-state approach with verified backups and restore testing.

No recovery command was executed against remote staging or production. No new local migration execution was performed. **Backup restoration: NOT TESTED.** Previously tested schema initialization is explicitly distinguished from a dump restore.

## Remaining risks and final boundary

- Condition B is point-in-time and limited to the VisionTech application state; it is not a complete Supabase disaster-recovery certification.
- Hosted Auth trigger privileges/event triggers can still cause deployment differences despite local success. M3 must finish before app/staff activation.
- Existing disabled-account self/actor read-policy considerations from P0-04 remain for review before staff activation; no security policy was changed.
- No backup or provider PITR is available. Docker availability and direct PostgreSQL tooling/authentication remain setup requirements if a new export/restore rehearsal becomes necessary.
- No `.env`, SQL file, migration, account, remote object, website deployment or GitHub state was modified. Only this requested report was added to the project.

**Recovery readiness: READY under condition B. Stop for separate explicit deployment approval; this report does not apply or authorize migrations.**
