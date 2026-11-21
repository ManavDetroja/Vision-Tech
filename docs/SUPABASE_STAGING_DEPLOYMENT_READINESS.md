# P0-04 — Supabase staging deployment readiness

Assessment date: 2026-11-15 (Asia/Calcutta). Project: `C:\Vision Tech`.

## Decision

**B. NOT READY — EXPLAIN BLOCKERS**

The staging identity, migration integrity, order, and current unapplied baseline are verified. However, the authenticated backup inventory returns **zero available backups**, **PITR disabled**, and no physical recovery metadata. No protected logical export or successful restore rehearsal has been verified. A usable recovery point and an identified restore owner/procedure are required before deployment approval.

This review applied no migrations, ran no migration repair/reset, created no history tables or users, changed no original SQL or `.env`, and deployed nothing. No production project was targeted. Only this report was added to the project; temporary catalog-only SQL files were prepared outside it.

## Project identity and tool evidence

- Owner-confirmed staging reference: `fszrsispjxunckknphaw`.
- `supabase/.temp/project-ref` matches exactly; checked before remote operations.
- Cached linked-project name: `VisionTech-Staging`.
- The configured `SUPABASE_URL` host reference was compared in memory and matches; no credential values were printed or copied.
- The remote CLI banners and backup response independently named this project and reference.
- Installed CLI: **3.1.0**, verified using `npx --offline supabase@3.1.0 --version` outside the restricted sandbox. The sandbox's separate npm cache initially returned `ENOTCACHED`; the existing user cache worked without installing another version.
- The CLI's `production` environment label means its main/default project classification. It does not override the owner's designation of this exact project as staging. No other project reference was used.

The four requested reports were reviewed. The execution plan contains older unlinked/unverified statements; these are superseded by the later verification/dry-run reports and the current checks below. Earlier 21/21 local pgTAP results are historical local evidence, not a claim of current hosted security tests.

## Migration verification

All three complete SQL files were reviewed. Exactly these files exist, with unique versions in this dependency order. Current SHA-256 values equal the values recorded after the successful P0-03 dry run:

| Order | File | SHA-256 |
| --- | --- | --- |
| 1 | `202611120001_secure_admin.sql` | `03920f5f77e1713606ed2429a3bac13e091d1cf6df5da0890b911bbc2c3664c7` |
| 2 | `202611120002_enquiry_lifecycle.sql` | `022c87ac5e7cae89205a0c63e41b74cec3ec274a8914a006e8513f8f8dd09f7c` |
| 3 | `20261112170000_security_hardening.sql` | `5c40e5f5c1e1c4c68d498b34e5fe1a771748bd44db660b85fa1655b7b7b50d4a` |

The mixed 12/14-digit prefixes remain unchanged; CLI 3.1.0 recognizes all three, and the successful disposable execution established the order. Do not rename them. Migration 1 creates the base schema and references existing Supabase Auth facilities. Migration 2 depends on it, renames RESOLVED to CLOSED, adds CONVERTED and follow-up fields/function/index, and replaces lifecycle policies/functions. Migration 3 depends on both and installs the final staff-role and search-path hardening.

Expected application objects after all three: 10 public tables, 4 enums, one sequence, 21 application functions, 22 indexes including constraint indexes, 11 foreign keys, 10 policies and 3 ordinary triggers. Pre-existing hosted functions/event triggers are additional objects; do not treat total function counts alone as a deployment test.

## Current read-only remote evidence

Executed from `C:\Vision Tech`:

```powershell
npx --offline supabase@3.1.0 migration list --remote=fszrsispjxunckknphaw --output-format text
```

Exit 0; output:

```text
Target: project VisionTech-Staging (fszrsispjxunckknphaw) · production
Initialising login role...

   Local            | Remote | Time (UTC)
  ------------------|--------|-----------------------
   `202611120001`   | ` `    | `202611120001`
   `202611120002`   | ` `    | `202611120002`
   `20261112170000` | ` `    | `2026-11-12 17:00:00`
```

All Remote cells are blank. The Time column is not a remote version. The CLI's authentication diagnostic is disclosed; no role-management SQL was issued by this review and internal authentication setup was not independently audited.

The catalog SELECT published in `SUPABASE_FINAL_STAGING_VERIFICATION.md` was executed again with the cached CLI 3.1.0 executable, `db query --remote=fszrsispjxunckknphaw --read-only --file <temporary-SQL-path>`. Additional SELECTs checked Auth prerequisite existence, schema privileges and event-trigger definitions. All exited 0 and reported `transaction_read_only = on` using `supabase_read_only_user`.

| Area | Current observation |
| --- | --- |
| Application migration schema and ledger | Both absent (`history_schema = null`, `history_relation = null`); no version SELECT against an absent relation |
| Public relations, columns, constraints, indexes, enums, policies | Empty arrays; expected application objects absent |
| Public/application and auth.users ordinary triggers | Empty array; expected three application triggers absent |
| Auth prerequisite | `auth.users` exists; no Auth user data was retrieved |
| Managed ledgers | Auth, Realtime and Storage ledgers exist; they are not application migration history |
| Extensions | pgcrypto 1.3 in extensions, plus pg_stat_statements, plpgsql, supabase_vault, uuid-ossp |
| Public functions | Existing `rls_auto_enable`; no expected application functions |
| Public CREATE privilege | False for both anon and authenticated |
| PostgreSQL | 17.11 |

Seven enabled hosted event triggers were observed: `issue_graphql_placeholder`, `pgrst_ddl_watch`, `pgrst_drop_watch`, `issue_pg_cron_access`, `issue_pg_net_access`, `issue_pg_graphql_access`, and `ensure_rls`. The last calls `public.rls_auto_enable`. Its inspected definition enables RLS on newly created public tables using quoted identifiers and a fixed pg_catalog search path; it catches/logs failures. It does not create application policies or replace the explicit RLS requirements in these migrations. Hosted event-trigger execution was not tested by applying DDL.

Conclusion: the three application migrations remain **NOT APPLIED**. The database is not globally empty. Existing managed schemas and the public event-trigger function must be preserved.

## Backup and recovery readiness

Read-only command, exit 0:

```powershell
npx --offline supabase@3.1.0 backups list --remote=fszrsispjxunckknphaw --output-format json
```

The cached CLI executable was used with these same subcommand/flags. Safe response fields:

```json
{
  "region": "ap-southeast-2",
  "walg_enabled": true,
  "pitr_enabled": false,
  "backups": [],
  "physical_backup_data": {},
  "message": "",
  "target": {
    "kind": "linked",
    "project_ref": "fszrsispjxunckknphaw",
    "project_name": "VisionTech-Staging",
    "environment": "production"
  }
}
```

WAL-G being enabled does **not** prove a completed, available recovery point. No backup timestamp or restore window is available in this response. The billing plan was not inspected; do not infer it from these fields. No backup was created, downloaded, enabled, purchased or restored during this task.

Supabase documents daily backup availability by plan, physical backup restoration, and logical exports through the CLI. Free projects should maintain their own exports. Database backups do not replace separate protection of Storage object bytes or external configuration. A restore can cause downtime and discard changes after its selected point. See [official backup guidance](https://supabase.com/docs/guides/platform/backups) and [Free-plan backup guidance](https://supabase.com/kb/faqs/platform/free-plan-backups).

### Safe export procedure to prepare separately

1. Choose a private, access-restricted, preferably encrypted folder **outside the repository and public web root**. Select a restore owner and document the target, timestamp, retention and recovery procedure. Treat exports as sensitive even when application tables are absent: managed Auth data may exist.
2. Recheck the explicit staging reference. Use existing CLI authentication or a protected PostgreSQL service/password file; do not put passwords in shell arguments, reports, Git, `.env.example`, or connection URLs printed to the terminal. Never print a `db dump --dry-run` script containing connection environment values.
3. CLI 3.1.0 local help confirms `db dump --remote=<ref> --file <path>`, `--data-only`, `--role-only`, and `--schema`. Example for an **application-schema-only** export, after preparing a protected destination:

```powershell
npx --offline supabase@3.1.0 db dump --remote=fszrsispjxunckknphaw --schema public --file "<PRIVATE_BACKUP_DIRECTORY>\public-schema.sql"
npx --offline supabase@3.1.0 db dump --remote=fszrsispjxunckknphaw --schema public --data-only --use-copy --file "<PRIVATE_BACKUP_DIRECTORY>\public-data.sql"
```

These commands are examples, **not executed**. The default CLI dump excludes managed schemas and does not include data or custom roles unless requested. Consequently a public-only dump is not sufficient recovery coverage for a migration that installs a trigger on `auth.users`. [CLI dump reference](https://supabase.com/docs/reference/cli/supabase-issue-feature#supabase-db-dump)

4. For broader logical recovery, a matching PostgreSQL client can use a protected `pg_service.conf` entry named `visiontech_staging`, with its host/user/database independently checked against the staging Dashboard. The service definition and protected password file stay outside the repository. A proposed full database custom-format export is:

```powershell
pg_dump --dbname="service=visiontech_staging" --format=custom --no-password --file="<PRIVATE_BACKUP_DIRECTORY>\staging-before-migrations.dump"
```

This service and export have **not** been configured or tested. Verify client/server compatibility and dump privileges first. A database dump does not capture cluster roles, provider settings or Storage file bytes. Managed schema ownership/permissions and platform dependencies require a Supabase-aware restore plan; do not assume arbitrary full-dump replay into a hosted project is supported.
5. Verify exit status, nonzero size, SHA-256 and archive contents (`pg_restore --list` for custom format), with sensitive contents kept private. Confirm inclusion of relevant public/Auth definitions, data, privileges and custom triggers, and review any exclusions. Validate recovery in a separately authorized disposable environment without exposing real Auth/customer data. Merely creating a file or listing it is not proof that it can be restored.
6. Alternatively obtain a completed provider recovery point with a documented restore window and authorized restore owner. Do not enable paid options without approval. The deployment gate stays closed until a usable recovery method is verified.

## Security and deployment risk review

| Area | Review and required handling |
| --- | --- |
| Auth trigger | M1 drops/recreates the specifically named custom trigger on auth.users. New profiles default to STAFF/DISABLED regardless of metadata; duplicate profiles are ignored. Local synthetic-user and duplicate tests passed previously. Existing Auth users are not backfilled. Trigger failure can fail signup; retain a recovery procedure for the managed-table customization. No users were created here. |
| Role assignment | Final M3 function allows ADMIN to manage only STAFF; SUPER_ADMIN may manage STAFF/ADMIN; SUPER_ADMIN targets and promotion to SUPER_ADMIN are excluded. RPC execution is service_role-only. Its actor parameter must come from a verified server-side session, never client claims. Keep admin/public API activation disabled until all three migrations and verification succeed. |
| RLS/grants | All ten application tables enable RLS; rate limits have no client policy/grant. Published products/services are readable publicly, customer enquiries require an active authorized role/assignment, and writes use restricted RPCs. Profiles permit self-read; activity permits actor-read even if the account is disabled. Confirm that intended retained self-access before staff activation; disabling is not a universal denial of every SELECT. |
| SECURITY DEFINER | M3 fixes existing application function search paths to pg_catalog, public, auth, pg_temp. Current anon/authenticated public CREATE privileges are false. Service-role-only entry points remain privileged and need server-side protection. Local grants/tests are useful evidence, not full hosted security certification. |
| Foreign keys/indexes | Parents are created before children. Auth-profile deletion cascades; other references deliberately use CASCADE, SET NULL or RESTRICT. These affect future deletion behavior; no deletion was performed. Unindexed referencing columns may merit later workload tuning, not an order blocker on the empty application schema. |
| Partial deployment | M2 contains a data backfill and enum changes; M3 replaces definitions. IF NOT EXISTS does not reconcile arbitrary pre-existing incompatible definitions. Do not expose the interim M1/M2 state. Files provide no down migrations; do not assume the entire three-file rollout is atomic. |
| Hosted context | Existing RLS event trigger and Supabase-managed schemas differ from a globally empty database. No conflict was observed in the catalog; actual hosted DDL compatibility and post-apply grants still require checks after approval. |

No top-level DROP TABLE, TRUNCATE or database reset is required by the migrations. Named trigger/policy replacements, enum alteration, default-settings insertion and lifecycle backfill are real effects and are not described as read-only or automatically reversible. Destructive statements inside business RPC bodies are only executed when those RPCs are later called; reviewing/creating their definitions does not run those business operations.

## Failure procedure and approval gates

If a future approved apply fails: stop, retain the sanitized error, read the actual ledger and catalogs, and determine the completed prefix. Do not blindly retry, repair history, manually create tracking tables, reset, or drop objects. Choose an explicitly reviewed forward fix or approved restore using the verified recovery point. Earlier committed files may remain even if a later file fails. Validate Auth trigger, roles, RLS, function ACLs, FKs and the exact expected ledger after any recovery.

Outstanding gates:

1. **Blocking:** establish and verify a usable backup/export, recovery coverage, restore owner and procedure. Current API inventory has no available recovery point.
2. Resolve the retained disabled-account self/actor read policy intent before staff activation; the 21 local tests do not cover every lifecycle/security case. No SQL edits are authorized here.
3. After recovery readiness, recheck the staging reference, hashes and baseline, review a fresh dry run if state has changed, and obtain explicit migration approval. The earlier passed dry run was not repeated because this review applies nothing and current hashes/order/baseline still match.
4. After a separately approved deployment, inspect exact object definitions/grants and run separately authorized staging security/Auth tests before activating the API or staff accounts. Do not infer email or website readiness from migration success.

**B. NOT READY — EXPLAIN BLOCKERS: no verified recovery point or restore procedure is currently available.**
