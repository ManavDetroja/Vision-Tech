# Staff activity RLS migration review

> Deployment update — 2026-11-22: Following the owner's explicit `APPROVE STAFF ACTIVITY RLS MIGRATION` authorization, this exact migration was applied to VisionTech-Staging (`fszrsispjxunckknphaw`). Deployment exit code 0; the ledger entry and restrictive policy were verified remotely. See [deployment report](STAFF_ACTIVITY_RLS_MIGRATION_DEPLOYMENT_REPORT.md). The pre-deployment findings below are preserved as historical review evidence; their pending-approval statements are superseded by this update.

Reviewed: 2026-11-22 (Asia/Calcutta). Scope: review and staging dry run only.

**Decision: ready for explicit deployment approval. The migration has NOT been applied.** The current staging policy still permits an authenticated disabled actor to read their own historical activity; the proposed policy closes that gap when deployed. No hosted authentication/email settings or applied migrations were changed.

## 1. Complete proposed SQL

File: `supabase/migrations/20261122000100_staff_activity_access.sql`

```sql
-- Prompt 7: additive restriction only. Requires explicit approval before remote apply.
-- Existing permissive activity policies allow an actor to read their old activity
-- even after deactivation. Keep their scope, but require an active profile too.
create policy activity_requires_active_account
on public.admin_activity as restrictive for select to authenticated
using (public.is_active_account());
```

## 2. Existing policy and proposed behavior

Current read-only staging catalog evidence shows one policy on `public.admin_activity`: `activity_read_admin_or_actor`, PERMISSIVE, SELECT, role `authenticated`. Its predicate, formatted for readability, is:

```sql
current_admin_role() = ANY (ARRAY['SUPER_ADMIN'::text, 'ADMIN'::text])
OR actor_id = auth.uid()
OR (
  entity_type = 'ENQUIRY'
  AND EXISTS (
    SELECT 1 FROM enquiries e
    WHERE e.id = admin_activity.entity_id
      AND e.assigned_to = auth.uid()
  )
)
```

The actor branch does not check account state. Although `current_admin_role()` returns a role only for ACTIVE profiles, that does not protect the independent actor branch.

This migration **does not replace or drop** that policy. It adds a RESTRICTIVE policy, giving this effective predicate for normal authenticated reads:

```text
(existing permissive access predicate) AND public.is_active_account()
```

PostgreSQL combines applicable restrictive policies with AND and requires an applicable permissive policy to pass. This preserves existing scope for active accounts while removing access for inactive accounts. See [PostgreSQL CREATE POLICY documentation](https://www.postgresql.org/docs/current/sql-createpolicy.html).

Current staging helper definitions were inspected directly. Both are SQL, STABLE, SECURITY DEFINER, owned by `postgres`, with `search_path = pg_catalog, public, auth, pg_temp`:

```sql
-- is_active_account(): boolean
select exists (
  select 1 from public.profiles
  where id = auth.uid() and account_state = 'ACTIVE'
);

-- current_admin_role(): text
select role::text from public.profiles
where id = auth.uid() and account_state = 'ACTIVE';
```

The predicate uses the current database profile, not a client-supplied account-state claim. At the query's transaction snapshot, a disabled or missing profile fails the gate. This does not retract data already downloaded or bypass PostgreSQL snapshot visibility rules for an already-running transaction.

## 3. Intended access and evidence

| Account/context | Result with proposed policy | Evidence |
| --- | --- | --- |
| ACTIVE STAFF | Own actor activity and activity associated with assigned enquiries remain visible; unrelated activity stays excluded | Existing local pgTAP results: suite 001 assertion 11; suite 003 assertion 1; current staging policy/helper inspection |
| ACTIVE ADMIN | Existing all-activity read scope retained | Existing permissive admin branch is true and active gate is true; semantic verification against current staging definitions |
| ACTIVE SUPER_ADMIN | Existing all-activity read scope retained | Same semantic verification as ADMIN |
| DISABLED authenticated account, including former administrator | No activity rows, including its own historical records | Existing local suite 003 assertion 3 passed; gate is false irrespective of actor/role/assignment |
| Missing profile | No activity rows | Helper EXISTS is false; semantic verification |
| Anonymous visitor | No activity SELECT privilege; no new access | Current effective privilege query and existing suite 001 assertion 5 |
| Service role / privileged database owner | Existing privileged access unchanged | Current service_role BYPASSRLS=true; postgres owns table; FORCE RLS=false |

The active administrator activity result is a policy-logic conclusion, not a claim that a new administrator login or remote fixture test was executed. No remote synthetic users or records were created. This restriction applies to authenticated RLS reads; it cannot replace backend authorization for operations executed using the service role or other RLS-bypassing contexts.

## 4. Unintended permission changes

No unintended access widening was identified. The migration contains exactly one CREATE POLICY statement. It changes no grants, helper functions, roles, Auth objects, table data, triggers, indexes, or other table policies. It does not alter the existing permissive policy.

Live effective table privileges, checked using `has_table_privilege`:

| Role | SELECT | INSERT | UPDATE | DELETE |
| --- | --- | --- | --- | --- |
| anon | false | false | false | false |
| authenticated | true | false | false | false |
| service_role | true | true | true | true |

SELECT policies can also affect operations requiring SELECT, such as UPDATE/DELETE/RETURNING. Here authenticated users have no direct activity write privileges, and service-role write access bypasses RLS, so no existing permitted direct authenticated write path is removed by this change.

RLS is enabled on `admin_activity`; FORCE RLS is false. The current helper ACLs permit execution by postgres, anon, authenticated and service_role; those existing grants are not changed. Anonymous helper execution does not grant activity-table access. The initial `information_schema.role_table_grants` query returned null under the inspecting role; it was not treated as proof of absent grants. The explicit effective privilege check above resolved that visibility limitation.

The helper adds a profile lookup to the read policy. No performance benchmark was run. CREATE POLICY is intentionally not idempotent: a pre-existing same-name policy would cause a deployment error rather than being overwritten. The new policy was absent both before and after the dry run.

## 5. Migration integrity

SHA-256 was recomputed from the actual migration bytes and matches the prior Prompt 7 documentation:

```text
E8580798304C7DB4D3E4AFCDD4C693F83D610E499F7564B9DEE73048AA8EBC79
```

All five applied migration hashes also match their recorded values:

| File | SHA-256 |
| --- | --- |
| 202611120001_secure_admin.sql | 03920F5F77E1713606ED2429A3BAC13E091D1CF6DF5DA0890B911BBC2C3664C7 |
| 202611120002_enquiry_lifecycle.sql | 022C87AC5E7CAE89205A0C63E41B74CEC3EC274A8914A006E8513F8F8DD09F7C |
| 20261112170000_security_hardening.sql | 5C40E5F5C1E1C4C68D498B34E5FE1A771748BD44DB660B85FA1655B7B7B50D4A |
| 20261116130000_enquiry_sequence_privileges.sql | 4BBBE374343541E51C083989A76CD99F95B47B465B6872ABA0C30822B1D6DD52 |
| 20261116130100_optional_enquiry_email.sql | 81B2792B09825732FCC0F96C17FF41AA8E98F90BBA06AABE894513437813825C |

The pending sixth version sorts after the five applied versions. No migration was edited, renamed, repaired, or applied during this review.

## 6. Current staging dry run

Local link: `supabase/.temp/project-ref` = `fszrsispjxunckknphaw`. The remote CLI response independently identified **VisionTech-Staging (fszrsispjxunckknphaw)**. CLI version: **3.1.0**. The CLI labels the project's default branch/environment `production`; that label belongs to the explicitly targeted staging project and does not identify a separate business production project.

The installed cached CLI executable was used, with its supported flags confirmed from local help. PowerShell command:

```powershell
& 'C:\Users\LEGION\AppData\Local\npm-cache\_npx\a2642d082f752488\node_modules\@supabase\cli-windows-x64\bin\supabase.exe' db push --dry-run --skip-vault --remote=fszrsispjxunckknphaw --workdir 'C:\Vision Tech'
```

`--skip-vault` explicitly excludes configured Vault secret updates. No include-seed, include-roles, include-all or automatic confirmation flags were used.

Complete captured CLI output:

```text
Target: project VisionTech-Staging (fszrsispjxunckknphaw) · production
Initialising login role...
DRY RUN: migrations will *not* be pushed to the database.
Would push these migrations:
 • 20261122000100_staff_activity_access.sql
{"upToDate":false,"dryRun":true,"migrations":["20261122000100_staff_activity_access.sql"],"seeds":[],"roles":[],"message":"Finished supabase db push.","target":{"kind":"linked","project_ref":"fszrsispjxunckknphaw","project_name":"VisionTech-Staging","environment":"production"}}
A new version of Supabase CLI is available: v3.2.0 (currently installed v3.1.0)
We recommend updating regularly for new features and bug fixes: https://supabase.com/docs/guides/cli/getting-started#updating-the-supabase-cli
```

Exit code: **0**. Exactly the intended pending migration was listed. No seed/role operations were listed. No destructive SQL exists in the pending file. The only CLI warning was availability of version 3.2.0; no CLI upgrade was performed.

The CLI printed `Initialising login role...` as part of its connection workflow; this is not evidence of applying the application migration. Do not interpret the dry run as a transaction-wide audit of every internal CLI connection action. The actual application catalog and migration ledger were explicitly compared before/after and were identical.

## 7. Read-only remote verification and tests

Before/after catalog inspections used `db query --remote=fszrsispjxunckknphaw --read-only --file <scratch-query.sql> --output-format json --workdir 'C:\Vision Tech'`. Both succeeded, and their normalized `review` objects compared exactly equal. Checked fields included ledger versions, activity policy predicates/roles/commands, RLS flags and owner, helper definitions/ACLs and role bypass flags.

Recorded ledger both times:

```text
202611120001
202611120002
20261112170000
20261116130000
20261116130100
```

Pending version `20261122000100` and policy `activity_requires_active_account` remained absent. This confirms no application migration was applied by this review.

Existing local execution artifacts were inspected, not rerun or relabeled as staging tests:

| Local suite | Recorded passed | Failed | Transaction cleanup |
| --- | --- | --- | --- |
| 001_rls_security_test.sql | 21 | 0 | ROLLBACK |
| 002_enquiry_api_security_test.sql | 18 | 0 | ROLLBACK |
| 003_staff_permissions_test.sql | 12 | 0 | ROLLBACK |
| Total | 51 | 0 | All rolled back |

The inspected runner injects the actual pending SQL immediately after BEGIN. Recorded cleanup: zero fixture Auth users, profiles, activities and enquiries; proposed policy not persisted. Prior baseline reproduction recorded `disabled_visible_before=1`. With the policy, the disabled staff test returned zero visible historical activity rows. Existing reports: `docs/STAFF_MANAGEMENT_TEST_REPORT.md` and `docs/ROLE_BASED_ACCESS_CONTROL.md`.

A dry run verifies migration selection/history compatibility; it does not execute the SQL or substitute for post-deployment RLS verification.

## 8. Operational notes and approval checkpoint

- An initial sandbox CLI help attempt failed with `PermissionDenied: FileSystem.writeFile` for a local `.supabase/telemetry.json.tmp.*` file. The approved outside-sandbox retry succeeded. It was an environment permission issue, not a database error.
- `.env` is ignored and untracked. No environment values were printed or written into this report.
- Git working tree was clean before creating this report. No code, SQL, applied migration, hosted authentication or email setting was changed. No commit or push was made.
- Evidence files are in the disposable workspace outside the project: `staff-activity-review-before.json`, `staff-activity-review-after.json`, `staff-activity-review-privileges.json`, `staff-activity-review-dry-run.txt`, and the two read-only review SQL files. They contain catalog metadata, not credential values.
- Approval must be for this exact filename/hash against this exact staging project. Recheck target, hash and pending plan if deployment occurs later.
- After an explicitly approved deployment, verify that the sixth ledger version and restrictive policy exist, the original policy remains, and relevant role behavior still matches the access matrix. Do not claim the fix is deployed before that verification.

**Awaiting explicit deployment approval. No migration applied.**
