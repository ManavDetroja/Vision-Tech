# Supabase Staging Migration Dry Run — P0-03

Date: 2026-11-15 (Asia/Calcutta). Project: VisionTech Solutions, C:\Vision Tech.

## Result

| Required decision | Result |
|---|---|
| Project identity | VERIFIED |
| Migration files | VERIFIED |
| Dry run | PASSED |
| Destructive operations detected | NO — no data-destructive deployment operation detected; named policy/trigger replacement clauses are disclosed below |
| Safe to request final deployment approval | YES — review readiness only; recovery readiness and explicit authorization remain required before applying |

The CLI exited 0, explicitly said migrations would not be pushed, and proposed exactly the three original files in dependency order. No actual migration was applied by this task. No repair, reset, manual history-table creation, admin/user creation, production access, or original migration edit was performed. Work stopped after the dry run; subsequent actions were local report/integrity checks only.

## Sources reviewed and dated findings

- SUPABASE_FINAL_STAGING_VERIFICATION.md: current 2026-11-15 read-only evidence records absent application migration schema/ledger, blank CLI Remote cells, and absent expected application objects. It also records existing managed schemas/extensions and the unrelated public function rls_auto_enable. The database must not be described as globally empty.
- SUPABASE_STAGING_MIGRATION_EXECUTION_PLAN.md: filenames, sequence, Auth dependency, no manual ledger creation, and recovery gates agree with source. Its earlier unlinked/not-ready status predates the current link and this successful dry run.
- SUPABASE_LOCAL_MIGRATION_TEST_REPORT.md: original files applied successfully in an isolated local stack; corrected pgTAP result was 21/21. No local tests were rerun in this milestone.
- SUPABASE_RLS_TEST_RESULTS.md: the older 0 passed / 21 blocked snapshot is superseded for local execution by the later local test report. It remains useful for coverage limitations, not current totals.
- SUPABASE_DATABASE_ARCHITECTURE.md: reviewed all listed migrations and application model. Its older unconfigured/filename-compatibility wording predates later evidence. The actual three SQL files govern this dry run.

## Project and environment verification

The owner-confirmed staging reference is **fszrsispjxunckknphaw**. Before every CLI invocation, a local guard compared:

1. supabase/.temp/project-ref: exact match.
2. supabase/.temp/linked-project.json reference: exact match; cached name VisionTech-Staging.
3. Root .env SUPABASE_URL hostname: matches the same reference, compared in memory only.
4. The command's explicit --remote reference: the same owner-confirmed reference.

The actual CLI target banner independently named VisionTech-Staging and this exact reference. No relink occurred. The banner's suffix production is the CLI's main/default-project classification, already explained from the cached CLI implementation in SUPABASE_FORENSIC_INVESTIGATION_REPORT.md; it does not identify a different business production project. Authorization here is bound to the exact owner-confirmed staging reference.

Runtime version: **3.1.0**, verified through npx using the cached pinned package. Local db push --help confirms local-by-default targeting, --remote, --dry-run, --skip-vault, and text output. Therefore an unqualified db push --dry-run would not provide the intended explicit remote target with this CLI.

Git check-ignore .env returned .env; git ls-files -- .env returned no paths. No credentials were printed, copied into the report, supplied as command arguments, or committed. The task did not modify .env or .env.example. Existing user changes were preserved and nothing was staged or committed.

## Migration inventory and dependencies

All files in supabase/migrations were enumerated; exactly these three files exist. There are no duplicate versions, extra files, or conflicting local version identifiers. Both 12-digit versions and the 14-digit version are recognized in the actual preview. No filename was changed.

| Order | Exact filename | Version | Digits | Bytes |
|---:|---|---|---:|---:|
| 1 | `202611120001_secure_admin.sql` | `202611120001` | 12 | 33423 |
| 2 | `202611120002_enquiry_lifecycle.sql` | `202611120002` | 12 | 8144 |
| 3 | `20261112170000_security_hardening.sql` | `20261112170000` | 14 | 5434 |

| Migration | Dependencies and migration-time effects |
|---|---|
| 202611120001 | Requires public/auth schemas, auth.users (id, email, raw_user_meta_data), auth.uid(), auth.role(), anon/authenticated/service_role, PL/pgSQL, and sufficient migration privileges including custom trigger creation on auth.users. Ensures pgcrypto; creates four enums, enquiry_number_seq, ten tables, initial indexes, 19 functions, RLS/policies/grants and two triggers. Inserts one default non-public contact-settings row. Creates parent profiles/enquiries tables before dependent FKs. No pre-existing application table or Auth user row is required. |
| 202611120002 | Requires M1 enums, profiles/enquiries/activity tables and functions. Renames RESOLVED to CLOSED if appropriate, adds CONVERTED and three lifecycle columns, backfills closed_at, adds follow-up index/function, and replaces status/dashboard/staff functions and activity policy. Backfill affects zero rows for an untouched fresh schema. |
| 20261112170000 | Requires M1/M2 tables and 20 named security-definer functions, including M2 follow-up function. Adds enquiries.updated_at, an invoker timestamp function/trigger, final staff-role restrictions and fixed function search paths. Must complete before enabling business access. |

Expected final application objects: 10 public tables with RLS enabled, 4 enums, 1 sequence, 11 foreign keys, 22 indexes including constraint-backed indexes, 21 functions, 3 non-internal triggers, and 10 policies across 9 tables. submission_rate_limits intentionally has no policy. Public tables: profiles, enquiries, enquiry_notes, admin_notifications, email_outbox, admin_activity, submission_rate_limits, products, service_content, site_settings. These are expected future objects, not claims of remote creation.

No unresolved local dependency/order conflict was found. Earlier local execution exercised these dependencies and the Auth trigger. The recent remote catalog records pgcrypto 1.3 in extensions and existing managed schemas; the dry run does not execute SQL or independently validate every hosted privilege, Auth API behavior, grant, or RLS boundary. Those remain post-apply verification requirements. No new catalog query was run after this dry run.

## Exact execution and complete CLI output

Working directory: C:\Vision Tech.

~~~powershell
npx --offline supabase@3.1.0 db push --remote=fszrsispjxunckknphaw --dry-run --skip-vault --output-format text
~~~

--offline reuses the cached npx package; it does not disable the CLI's authorized remote database connection. --remote fixes the target explicitly. --dry-run is the non-application guard. --skip-vault excludes Vault secret updates mentioned by CLI help. No --include-all, --include-roles, --include-seed, password argument, or --yes mutation flag was supplied. The capture helper allowed only fixed version/help/dry-run commands and checked original migration hashes before invocation.

Started UTC: 2026-11-15T04:00:30.812Z. Completed UTC: 2026-11-15T04:00:39.952Z. Exit code: 0. Process error: none. Stdout: 27 bytes; stderr: 304 bytes. Captures below are complete, unmodified CLI streams; stdout/stderr were retained separately, so their display order here is not a claim about terminal interleaving. The capture helper's own status message is not part of CLI output.

Standard output:

~~~text
Finished supabase db push.
~~~

Standard error:

~~~text
Target: project VisionTech-Staging (fszrsispjxunckknphaw) · production
Initialising login role...
DRY RUN: migrations will *not* be pushed to the database.
Would push these migrations:
 • 202611120001_secure_admin.sql
 • 202611120002_enquiry_lifecycle.sql
 • 20261112170000_security_hardening.sql
~~~

The stdout sentence Finished supabase db push. is the CLI's generic command-completion message. It does not mean migrations were applied: the simultaneous dry-run diagnostic explicitly says they were not pushed and labels the files Would push.

## Safety analysis and limitations

- Exactly three pending migrations appeared, in the expected original order. There were no extra/unknown migrations, history mismatch warnings, SQL errors, or execution errors. This is consistent with the independently recorded absent ledger/application schema; dry-run output alone is not a new full catalog inventory.
- No reset, DROP TABLE/SCHEMA/COLUMN, TRUNCATE, top-level customer DELETE, role seed, or product/customer seed deployment is proposed. The preview lists filenames, not a statement-by-statement SQL safety analysis; the SQL files were inspected separately.
- The migration source does contain DROP POLICY/DROP TRIGGER followed by replacement, CREATE OR REPLACE functions, grants/revokes, and an enum rename. These are intentional schema/security changes, including the custom auth.users trigger, and are not zero-change operations in a future real deployment. In the verified initial baseline the named application objects are absent. This report's NO destructive operations means no data-destruction/reset operation detected, not that the SQL contains no DROP keyword.
- M1's settings INSERT and M2's lifecycle UPDATE are real migration-time writes in a future apply; neither ran here. Runtime RPC definitions contain authorized enquiry deletion/rate-bucket cleanup, but defining those bodies does not execute those deletions.
- The CLI printed Initialising login role... during authentication. No role-management command was requested or issued by this task; internal CLI login setup was not independently audited for zero system-level effects. --skip-vault expressly excludes Vault updates. No claim is made that all infrastructure internals were independently monitored.
- Dry run checks the deployment selection, not actual remote SQL execution. Historical local 21/21 passing assertions are not remote security tests or a full security certification.
- No down migrations are supplied. A later actual multi-file deployment must not be assumed atomic across all three files. If it fails, stop and inspect ledger plus object state read-only; do not blindly retry, repair history, reset, or manually create the ledger.

## Integrity and remaining prerequisites

Original migration disk hashes were compared before and after the dry run and were unchanged. git diff --exit-code HEAD -- supabase/migrations returned 0 with no diff before the dry run; the final delivery check repeats it. The hash values also match the prior final verification report.

| File | Unchanged SHA-256 |
|---|---|
| 202611120001_secure_admin.sql | 03920f5f77e1713606ed2429a3bac13e091d1cf6df5da0890b911bbc2c3664c7 |
| 202611120002_enquiry_lifecycle.sql | 022c87ac5e7cae89205a0c63e41b74cec3ec274a8914a006e8513f8f8dd09f7c |
| 20261112170000_security_hardening.sql | 5c40e5f5c1e1c4c68d498b34e5fe1a771748bd44db660b85fa1655b7b7b50d4a |

Before any separately authorized actual deployment:

1. Review this dry-run output and the intentional Auth trigger/security changes; explicitly authorize staging application of these exact three original files only.
2. Confirm an available staging backup/recovery point and a named restore owner/procedure. This task did not establish a recovery point or verify hosted backup availability.
3. Reconfirm the exact staging link and unchanged migration hashes. If time or other work has changed the target, repeat the read-only baseline and dry run before applying.
4. Keep application/admin access disabled until all three files and post-deployment catalog/security checks pass. Do not create an initial administrator as part of migration deployment.
5. Let the supported migration workflow manage its own history on first actual deployment; never manually create or populate supabase_migrations.schema_migrations and never use migration repair to simulate success.
6. After a separately approved apply, verify ledger versions, expected object definitions, Auth trigger, RLS and function grants. Remote tests that insert fixtures require separate authorization; none ran here.

## Files changed and execution access

Only docs/SUPABASE_STAGING_DRY_RUN_REPORT.md was added to the VisionTech project by this milestone. Capture/generation helpers and raw evidence reside in the separate Codex workspace, not the website repository. Original migration SQL, test SQL, application code, configuration, image assets, .env and .env.example were preserved.

The initial sandboxed Git read was denied (cannot change to C:\Vision Tech: Permission denied). The identical read-only Git checks succeeded with approved elevated access. CLI help/version and the authorized remote dry run also used approved elevated execution. This was an execution-environment permission issue, not a Supabase migration failure.

**Recommendation: ready to request explicit final staging deployment approval, subject to confirming the recovery prerequisites. No deployment is authorized or performed by this report.**
