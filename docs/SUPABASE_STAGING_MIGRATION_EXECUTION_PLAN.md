# Supabase Staging Migration Execution Plan

**Date:** 2026-11-13
**Project:** VisionTech Solutions™
**Current decision:** **NOT READY FOR STAGING MIGRATION APPROVAL**

This is a planning document only. No staging or production database was contacted, no migration was applied/repaired/renamed/reset, and no account was created.

## Readiness review

| Gate | Result | Evidence / remaining action |
|---|---|---|
| Local migration compatibility | **PASS** | Supabase CLI 3.1.0 listed both 12-digit versions and the 14-digit version in the disposable local test. Original names were applied in order. |
| Migration execution locally | **PASS** | All three originals applied to the disposable local Supabase database. Catalog inspection found 10 public tables with RLS, 10 policies, 22 indexes, 21 public functions, and three non-internal triggers. |
| Auth trigger behavior | **PASS locally** | A synthetic local Auth user received one `STAFF` / `DISABLED` profile; duplicate behavior was checked in a transaction and rolled back. Staging still needs review because the trigger is on managed `auth.users`. |
| pgTAP suite | **PASS after test correction** | The 21-assertion suite passed 21/21 after correcting the expected activity count. No migration SQL changed. |
| Original migration files | **PASS** | No diff against `HEAD`; original filenames and contents remain unchanged. |
| `.env` safety | **PASS** | `.env` matches the `.gitignore` rule and is not tracked. No secret value was printed or included here. |
| Staging project identity | **PASS — owner-confirmed** | The owner confirms the configured `SUPABASE_URL` reference matches the `VisionTech-Staging` Dashboard Reference ID. The reference value is intentionally omitted. This was not independently checked through a remote request in this milestone. |
| Public baseline and migration ledger | **PASS — owner-confirmed baseline** | Public application table and public RLS-table queries returned no rows. `supabase_migrations.schema_migrations` is absent (`42P01`); no remote migration has been applied. These facts do not imply the managed `auth`, `storage`, or other Supabase schemas are empty. |
| CLI link in this worktree | **NOT SET** | `supabase/.temp/project-ref` is absent. Before deployment, link with the owner-confirmed staging ref and compare the resulting local marker to that ref. Do not proceed on a mismatch. |
| Backup/recovery readiness | **MANUAL PRE-DEPLOY CHECK** | No staging backup/restore point or rehearsal was verified in this planning-only task. Confirm an available recovery point and who can restore it before the first write. |

## Test diff review

The exact diff in `supabase/tests/001_rls_security_test.sql` changes one assertion:

```diff
- select extensions.is((select count(*)::integer from public.admin_activity), 1, 'staff sees activity for assigned enquiry only');
+ select extensions.is((select count(*)::integer from public.admin_activity), 2, 'staff sees assigned enquiry event and own actor event only');
```

The test inserts two enquiries; the `enquiry_created_events` trigger automatically creates an activity event for each. It then inserts two explicit synthetic activity rows. Staff A is entitled to see the event for their assigned enquiry and their own actor event, so the expected visible count is two. Staff B's activity is on B's enquiry and must remain invisible to A.

The change retains the same `extensions.is(...)` assertion at the same point in the 21-test plan, changes no policy/RLS test, and removes no assertion. It still checks an exact row count; if the unauthorized B activity is additionally visible, the count becomes three and the assertion fails. The corrected suite passed 21/21 locally. This validates the test expectation against the trigger-generated fixture; it is not a substitute for broader production security testing.

## Original migrations and filename decision

The three original migration paths were compared with `HEAD` and remain unchanged:

1. `supabase/migrations/202611120001_secure_admin.sql` — version `202611120001`.
2. `supabase/migrations/202611120002_enquiry_lifecycle.sql` — version `202611120002`.
3. `supabase/migrations/20261112170000_security_hardening.sql` — version `20261112170000`.

Keep these names. CLI 3.1.0 recognized them and ordered them correctly. Renaming temporary 12-digit copies to 14-digit versions made the original applied versions appear unmatched and the new versions pending. Use a 14-digit UTC timestamp for future migrations; do not rewrite this history.

## Temporary directory inspection

The two paths below were created for this disposable test and confirmed to be under the Windows temp directory. They were inspected by filename and size only; neither was deleted because the execution policy rejected deletion. The Supabase containers and database volumes were stopped/removed with the project-specific ID and `--no-backup`. No `.env` was copied.

### `C:\Users\LEGION\AppData\Local\Temp\VisionTech-P0-02B-Disposable-20261113`

- `auth-activity-check.sql` — 1,687 bytes.
- `auth-trigger-check.sql` — 1,387 bytes.
- `supabase/config.toml` — 16,808 bytes.
- `supabase/.branches/_current_branch` — 4 bytes.
- `supabase/.temp/cli-latest` — 6 bytes.
- `supabase/migrations/202611120001_secure_admin.sql` — 33,423 bytes.
- `supabase/migrations/202611120002_enquiry_lifecycle.sql` — 8,144 bytes.
- `supabase/migrations/20261112170000_security_hardening.sql` — 5,434 bytes.
- `supabase/tests/001_rls_security_test.sql` — 6,861 bytes.
- `supabase/tests/001_rls_security_test_corrected_temp.sql` — 6,874 bytes.
- `filename-14-digit-experiment/supabase/config.toml` — 16,808 bytes.
- `filename-14-digit-experiment/supabase/.temp/cli-latest` — 6 bytes.
- `filename-14-digit-experiment/supabase/migrations/20261112000100_secure_admin.sql` — 33,423 bytes.
- `filename-14-digit-experiment/supabase/migrations/20261112000200_enquiry_lifecycle.sql` — 8,144 bytes.
- `filename-14-digit-experiment/supabase/migrations/20261112170000_security_hardening.sql` — 5,434 bytes.

### `C:\Users\LEGION\AppData\Local\Temp\VT_P002B_corrected`

- `supabase/config.toml` — 16,808 bytes.
- `supabase/.temp/cli-latest` — 6 bytes.
- `supabase/tests/001_rls_security_test.sql` — 6,874 bytes.

The recursive `Remove-Item` cleanup request was rejected by the execution policy even after the exact resolved paths were checked. These directories remain and should be manually removed after review if no longer needed. The unrelated `open-webui` container was not touched.

## Staging project reference and migration-history handling

The owner has now confirmed that the reference encoded in `SUPABASE_URL` matches the `VisionTech-Staging` Dashboard Reference ID. The value is omitted here. This confirmation is owner-provided; no remote request was made in this task. The CLI worktree is not currently linked (`supabase/.temp/project-ref` is absent). Before deployment, establish and verify the local CLI link:

1. Use the already owner-confirmed non-secret project reference; do not paste any API key, database password, or secret into a command or report.
2. After explicit authorization for staging preflight, authenticate the CLI if needed and link this worktree using `supabase link --project-ref <confirmed-reference>`.
3. Compare `supabase/.temp/project-ref` with the confirmed reference locally without printing either value. If they differ or the marker is absent, stop.
4. Use an explicit `--remote=<confirmed-reference>` on every migration-list and push command; do not rely on an implicit linked target alone.

The owner-confirmed read-only inspection found `supabase_migrations.schema_migrations` absent (PostgreSQL `42P01`), and no remote migrations have been applied. The missing relation is expected for a first CLI-managed deployment; it is not proof that all schemas or objects are empty. Supabase documentation states that the first `db push` creates the CLI-managed migration-history table and records each successfully applied version. The installed CLI is **3.1.0**; local `--help` confirms `db push --dry-run`, `--remote=<ref>`, and `link --project-ref` are supported. The exact dry-run behavior against this owner's absent-ledger staging state has not been exercised because this task forbids remote requests.

Older setup/connection reports that say the project identity or public baseline was unverified predate the owner's confirmation in this request. This plan records the newer owner-confirmed observations, without claiming an independent remote check.

Migration history must be handled only through the supported Supabase CLI workflow:

1. Once the CLI link marker matches the owner-confirmed reference, run the read-only baseline checks below and check `to_regclass('supabase_migrations.schema_migrations')`. Query ledger versions only if the table exists.
2. The owner has confirmed there are no remote migration rows because the relation does not exist and no remote migrations have been applied. Treat that as an empty initial migration history only after the pre-deployment catalog checks find no conflicting manually created app objects.
3. Run `supabase db push --dry-run` with the explicit staging ref. It must list exactly the three migrations in this plan and state that it will not apply them. If it fails with `42P01`, prints a different target, or proposes any extra migration/seed/role change, stop. Do not bypass the dry run or create the ledger manually.
4. After explicit approval to apply, use the supported `db push` workflow. Supabase documents that the first push creates `supabase_migrations.schema_migrations`; the CLI then records each successfully applied version. Do not manually create the schema/table or use `migration repair`. ([Supabase CLI `db push` reference](https://supabase.com/docs/reference/cli/introduction), [Supabase migration-history guidance](https://supabase.com/kb/troubleshooting/error-relation-supabase_migrationsschema_migrations-does-not-exist-a787d6))
5. Verify the resulting ledger and database objects using the post-deployment checks below. If the first push errors or CLI behavior differs, stop and inspect actual state read-only before any retry.

The current owner-confirmed baseline is that the public application-table and public RLS-table queries returned no rows, the migration-history query failed with `42P01` because the relation is absent, and no remote migration has been applied. It does not establish that public types/functions/triggers/extensions are absent, nor that Supabase-managed schemas are empty. The pre-deployment object inventory remains required.

## Exact migrations and expected application order

Only after all gates pass and explicit staging approval is given:

1. `202611120001_secure_admin.sql` — base admin/enquiry/catalogue schema, types, sequence, functions, tables, policies, grants, default site settings, and the Auth/enquiry triggers.
2. `202611120002_enquiry_lifecycle.sql` — enquiry lifecycle enum/columns, follow-up index/function, updated staff/status/dashboard functions, and activity policy.
3. `20261112170000_security_hardening.sql` — `updated_at` trigger and final `SECURITY DEFINER` search-path/staff-role hardening.

Do not expose the app or activate admin access between migrations 1 and 3. Migrations 1 and 2 have less restrictive staff-role function implementations; migration 3 is required to enforce final restrictions.

Expected final local-test object shape: 10 `public` application tables (`profiles`, `enquiries`, `enquiry_notes`, `admin_notifications`, `email_outbox`, `admin_activity`, `submission_rate_limits`, `products`, `service_content`, `site_settings`); four enums; `enquiry_number_seq`; 22 public indexes; 21 public functions; 10 RLS policies across 10 RLS-enabled tables; and three non-internal triggers including `auth_user_profile_created` on managed `auth.users`. `pgcrypto` is installed if absent. These are expected results, not claims about the current staging database.

## Planned commands after approval (not run in this milestone)

Use the verified project reference in place of `<VERIFIED_STAGING_REF>`; do not put secrets in command text or reports. The local CLI 3.1.0 help supports the explicit `--remote=<ref>` and `--dry-run` flags. Commands remain unrun until project identity, baseline, recovery plan, and explicit approval are complete. ([Supabase deploy-migrations guide](https://supabase.com/docs/guides/deployment/database-migrations))

```powershell
$verifiedStagingRef = '<reference copied from the confirmed Dashboard project>'
npx --yes supabase@3.1.0 link --workdir "C:\Vision Tech" --project-ref $verifiedStagingRef
$linkedRef = (Get-Content "C:\Vision Tech\supabase\.temp\project-ref" -Raw).Trim()
if ($linkedRef -ne $verifiedStagingRef) { throw 'Supabase CLI link does not match the confirmed staging reference.' }
npx --yes supabase@3.1.0 migration list --workdir "C:\Vision Tech" "--remote=$verifiedStagingRef"
npx --yes supabase@3.1.0 db push --workdir "C:\Vision Tech" "--remote=$verifiedStagingRef" --dry-run
```

The commands above are a future sequence, not run in this milestone. CLI linking may require an authenticated Supabase CLI session; never place credentials in the command line or report. If the read-only `migration list` reports that the history relation is absent, record `42P01` and continue only to the dry run if the target and baseline are correct. Review that the dry run proposes exactly the three versions above and nothing else. Only after a separate explicit migration approval should the same `db push` be run without `--dry-run`. When the owner runs it interactively, leave the Supabase confirmation enabled. Supabase CLI v3 documentation notes that agent/non-interactive executions cannot answer that prompt; if an agent is explicitly asked to execute after approval, it must obtain that approval first and only then pass the CLI's `--yes` mutation flag. Never use `--yes` to bypass an absent approval. Re-run `migration list` after applying and perform the post-migration checks below. ([CLI v3 migration behavior](https://supabase.com/docs/guides/local-development/cli/migrating-to-v3))

## Pre-migration and post-migration verification SQL

The following are templates for a future staging review. They were not run here. Execute only after the verified project ref is selected and the separate approval covers remote read-only access.

### Pre-migration: tracking ledger presence

```sql
select to_regclass('supabase_migrations.schema_migrations') as migration_ledger;
```

Only if `migration_ledger` is non-null:

```sql
select version
from supabase_migrations.schema_migrations
order by version;
```

### Pre-migration: public tables and RLS state

```sql
select n.nspname as schema_name,
       c.relname as relation_name,
       c.relkind as relation_kind,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p', 'v', 'm')
order by c.relkind, c.relname;
```

### Pre-migration: relevant types, functions, extensions, and Auth trigger

```sql
select t.typname, e.enumlabel, e.enumsortorder
from pg_type t
join pg_namespace n on n.oid = t.typnamespace
left join pg_enum e on e.enumtypid = t.oid
where n.nspname = 'public'
  and t.typname in ('admin_role', 'account_state', 'enquiry_status', 'enquiry_type')
order by t.typname, e.enumsortorder;

select p.proname, pg_get_function_identity_arguments(p.oid) as arguments,
       p.prosecdef as security_definer, p.proconfig
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by p.proname;

select extname, extversion from pg_extension where extname = 'pgcrypto';

select t.tgname, pg_get_triggerdef(t.oid) as definition
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'auth' and c.relname = 'users' and not t.tgisinternal;
```

If the ledger, a target public object, or the named Auth trigger exists in an unexpected state, stop before applying anything. Do not infer that the staging DB is empty from the earlier public-table-only report.

### Post-migration: versions, table/RLS state, and policies

```sql
select version
from supabase_migrations.schema_migrations
order by version;

select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relname;

select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

### Post-migration: triggers and privileged function grants

```sql
select n.nspname, c.relname, t.tgname, pg_get_triggerdef(t.oid) as definition
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('auth', 'public') and not t.tgisinternal
order by n.nspname, c.relname, t.tgname;

select p.proname,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
       has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('admin_set_staff', 'submit_public_enquiry', 'admin_set_email_delivery')
order by p.proname;
```

Expected privileged RPC access: `admin_set_staff`, `submit_public_enquiry`, and `admin_set_email_delivery` are not executable by `anon` or `authenticated` and are executable by `service_role`. Compare the complete resulting catalog with the local migration report; counts alone are not sufficient.

## Rollback and recovery limits

- These files do not provide down migrations. Treat the three-file rollout as not automatically reversible.
- Do not assume all three migrations are one atomic transaction. If any migration or post-check fails, stop and capture the exact error and ledger/object state; do not continue, rerun blindly, repair history, drop objects, or reset staging.
- Before any apply, confirm a usable pre-migration staging backup/recovery point and who can restore it. Confirm whether it covers the database objects/data and managed Auth dependencies relevant to this change; do not claim recoverability until verified.
- For partial application, compare the CLI ledger and actual schema with the completed prefix. Recovery must be an explicitly reviewed forward-fix migration or an approved restore from the verified recovery point. Manual ledger insertion/deletion is prohibited in this plan.
- The Auth trigger change is on a Supabase-managed table and needs explicit staging approval. No admin bootstrap or user creation is included.

## Remaining manual prerequisites

1. Establish and verify the CLI's local `project-ref` marker against the already owner-confirmed staging reference; this worktree is not linked now.
2. Before the first write, perform the planned read-only catalog checks for public types/functions/triggers/extensions and the existing Auth trigger; empty public table results do not cover all schemas.
3. Confirm a staging recovery point and restore owner/procedure.
4. Review the dry-run output and provide explicit approval before the first `db push`.

No CLI link, remote SQL query, dry run, or migration command was executed in this planning milestone. The Supabase docs describe automatic migration-table initialization on first push and the non-applying dry-run workflow; the exact first-deployment dry-run was not tested against staging. ([CLI workflow guide](https://supabase.com/docs/guides/local-development/cli-workflows), [CLI v3 migration behavior](https://supabase.com/docs/guides/local-development/cli/migrating-to-v3))

**NOT READY FOR STAGING MIGRATION APPROVAL.** The owner-confirmed project reference and public baseline resolve the earlier identity/baseline uncertainty, but the CLI is currently unlinked, non-table object checks have not been performed against staging, the recovery point is unverified, and the required staging dry run has not been performed. No migration should be approved for application until those manual gates pass and the dry run lists exactly the three expected versions.
