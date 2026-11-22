# Staff activity RLS migration deployment

Date: 2026-11-22 (Asia/Calcutta).

**Result: applied and catalog-verified on VisionTech-Staging only.**

## Authorization and target

The owner explicitly approved: `APPROVE STAFF ACTIVITY RLS MIGRATION`.

- Project: VisionTech-Staging.
- Exact reference: `fszrsispjxunckknphaw`.
- Local CLI link matched; remote responses independently confirmed the name/reference.
- CLI version used: 3.1.0, same cached executable used in the approved review.
- The CLI's `production` environment label denotes the default branch of this staging project. No separate business production project was targeted.

## Pre-deployment checks

All six local migration hashes matched the approved review, including all five previously applied migrations. Exactly six migration files were present. Approved file:

`supabase/migrations/20261122000100_staff_activity_access.sql`

SHA-256, verified before and after deployment:

```text
E8580798304C7DB4D3E4AFCDD4C693F83D610E499F7564B9DEE73048AA8EBC79
```

The fresh read-only catalog snapshot matched the prior review exactly: five ledger entries; existing permissive policy present; new restrictive policy absent; helpers, RLS flags, owners and inspected privileges unchanged.

A fresh `db push --dry-run --skip-vault --remote=fszrsispjxunckknphaw --workdir 'C:\Vision Tech'` returned exit code 0 and listed only `20261122000100_staff_activity_access.sql`, with empty seed/role lists. The selected target and exact one-file plan were checked programmatically before deployment.

One initial preflight attempt failed before executing SQL because `--file staff-activity-review-catalog.sql` resolved under the CLI workdir rather than the disposable workspace. Exact error: `DbQueryReadFileError: failed to read SQL file: NotFound: FileSystem.readFile (C:\Vision Tech\staff-activity-review-catalog.sql)`. Using the existing scratch SQL's absolute path resolved it. This was not a database discrepancy or migration failure.

## Deployment command and result

```powershell
& 'C:\Users\LEGION\AppData\Local\npm-cache\_npx\a2642d082f752488\node_modules\@supabase\cli-windows-x64\bin\supabase.exe' db push --skip-vault --remote=fszrsispjxunckknphaw --workdir 'C:\Vision Tech' --yes
```

`--yes` executed the owner's explicit approval. `--skip-vault` excluded Vault secret updates. No include-seed, include-roles, include-all, repair or reset flags were used.

Captured output:

```text
Target: project VisionTech-Staging (fszrsispjxunckknphaw) · production
Initialising login role...
Confirmed by --yes: Apply 1 migration on project VisionTech-Staging (fszrsispjxunckknphaw) · production
Applying migration 20261122000100_staff_activity_access.sql...
{"upToDate":false,"dryRun":false,"migrations":["20261122000100_staff_activity_access.sql"],"seeds":[],"roles":[],"message":"Finished supabase db push.","target":{"kind":"linked","project_ref":"fszrsispjxunckknphaw","project_name":"VisionTech-Staging","environment":"production"}}
A new version of Supabase CLI is available: v3.2.0 (currently installed v3.1.0)
We recommend updating regularly for new features and bug fixes: https://supabase.com/docs/guides/cli/getting-started#updating-the-supabase-cli
```

Exit code: **0**. No migration failure occurred. No automatic repair or rollback was attempted. The CLI update notice was informational; no tool upgrade was performed.

## Post-deployment verification

Read-only catalog and effective privilege queries completed successfully against the same explicit project reference. Remote ledger now contains:

```text
202611120001
202611120002
20261112170000
20261116130000
20261116130100
20261122000100
```

| Check | Actual result |
| --- | --- |
| New policy | `activity_requires_active_account`, RESTRICTIVE, SELECT, `{authenticated}`, USING `is_active_account()` |
| Existing policy | `activity_read_admin_or_actor` remains PERMISSIVE; its exact predicate is unchanged |
| RLS | Enabled on `public.admin_activity`; FORCE RLS remains false |
| Helpers | Definitions, owner, SECURITY DEFINER behavior, hardened search paths and ACLs unchanged |
| Anonymous table privileges | SELECT/INSERT/UPDATE/DELETE all false |
| Authenticated table privileges | SELECT true; INSERT/UPDATE/DELETE false |
| Service-role table privileges | SELECT/INSERT/UPDATE/DELETE true; BYPASSRLS unchanged |
| Local migration | Hash unchanged; no migration SQL edited |

Programmatic comparison removed only the expected new ledger entry and expected policy from the after-snapshot. The remaining inspected catalog data exactly matched the before-snapshot. Effective table privileges also exactly matched the prior review. This is a scoped comparison of the inspected objects, not an exhaustive whole-database diff.

The effective authenticated SELECT rule is now the existing access predicate AND `is_active_account()`. Active staff retain their existing own/assigned-enquiry activity scope. Active ADMIN/SUPER_ADMIN retain their existing activity scope. Disabled or missing profiles fail the new gate, including access to historical actor records. Existing service-role bypass access remains unchanged and still requires backend authorization.

## Test evidence and limits

- Fresh remote checks: target identity, migration history, policy definition, original-policy preservation, RLS flags, helper definitions/ACLs, effective table privileges and unchanged migration hash — passed.
- Existing local evidence reviewed in the preceding review: 51/51 pgTAP assertions passed across three rollback suites, including active staff visibility and disabled staff historical-activity denial.
- The local suites were not rerun during this deployment and are not reported as staging test executions.
- No remote synthetic users, profiles or activity fixtures were created. No new role-based login/browser test or live fixture-based RLS behavior test was run. Administrator preservation is confirmed from the deployed predicates and unchanged helpers, rather than a new administrator login.
- Transaction snapshots and previously downloaded data are unaffected by account deactivation. Privileged service-role/owner access does not become subject to this authenticated policy.

## Evidence and changes

The disposable workspace `C:\Users\LEGION\Documents\Codex\2026-11-13\p0-02b-disposable-local-supabase-migration` contains:

- `staff-activity-deploy-before.json` and `staff-activity-deploy-after.json` — inspected catalog snapshots.
- `staff-activity-deploy-dry-run.txt` — fresh one-migration preview.
- `staff-activity-deployment-output.txt` — captured deployment output.
- `staff-activity-deploy-privileges.json` — post-deployment effective privileges.
- `staff-activity-review-catalog.sql` and `staff-activity-review-privileges.sql` — exact read-only queries used for verification.

Project documentation changed: this report created; `docs/STAFF_ACTIVITY_RLS_MIGRATION_REVIEW.md` updated with a deployment-status notice while preserving the original review. No original or applied migration files changed. No hosted authentication/email settings, website deployment or production configuration changed. No credentials were printed. No Git commit or push was performed.

**Approved staging migration deployment complete; remote ledger and policy verified.**
