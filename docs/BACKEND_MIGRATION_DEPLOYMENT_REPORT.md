# VisionTech backend migration deployment

Date: 2026-11-16 (Asia/Calcutta).
Target: **VisionTech-Staging — fszrsispjxunckknphaw**.
Authorization received: **APPROVE VISIONTECH BACKEND MIGRATIONS**.

## Result

**Both approved migrations applied successfully and verified remotely.** All five application versions are now recorded. Direct sequence access is denied to anon, authenticated and service_role while legitimate enquiry creation works through the postgres-owned SECURITY DEFINER RPC. HTTP submissions with email omitted now work on staging.

Hosted security results: **39/39 assertions passed** (21 existing + 18 sequence/email assertions). Actual staging HTTP verification completed **21 logged check events**, including repeated secret-response checks; these are not 21 distinct test cases. Final aggregate verification confirms no synthetic users or records remain. No production access, website deployment, original migration modification, repair/reset, automatic rollback, commit or GitHub push occurred.

## Guarded preflight

The linked project marker and configured SUPABASE_URL reference matched the expected owner-confirmed staging reference. Every remote command used an explicit --remote=fszrsispjxunckknphaw. CLI 3.1.0 was used from its cached npx installation. The CLI banner suffix `production` refers to the project's main/default branch classification; the verified project reference remains the owner's staging project.

All five local migration filenames and hashes matched the reviewed inventory. The remote ledger contained only the three original versions; application/customer/Auth/Storage data baseline was empty except the one site_settings seed row. Recovery remained the previously accepted empty-application-schema Condition B, not a claim of a full managed-database backup.

## Approved migrations

| Order | File | SHA-256 |
| --- | --- | --- |
| 1 | `20261116130000_enquiry_sequence_privileges.sql` | `4bbbe374343541e51c083989a76cd99f95b47b465b6872aba0c30822b1d6dd52` |
| 2 | `20261116130100_optional_enquiry_email.sql` | `81b2792b09825732fcc0f96c17ff41aa8e98f90bba06aabe894513437813825c` |

The first migration revokes direct permissions on enquiry_number_seq from PUBLIC, anon, authenticated and service_role. The second changes only submit_public_enquiry to accept absent/blank email and store empty text, preserving the existing NOT NULL column. Supplied invalid email remains rejected. No fabricated email address is used. Historical comments saying "pending approval" remain in the immutable migration files; deployment status is recorded here and in the remote ledger.

## Dry run

Equivalent pinned npx command:

```powershell
npx --offline supabase@3.1.0 db push --dry-run --remote=fszrsispjxunckknphaw --skip-vault --output-format text
```

Exit code: 0. Complete captured streams follow (stdout and stderr are kept separate; their interleaving is not inferred).

stdout:
```text
Finished supabase db push.
```
stderr:
```text
Target: project VisionTech-Staging (fszrsispjxunckknphaw) Â· production
Initialising login role...
DRY RUN: migrations will *not* be pushed to the database.
Would push these migrations:
 â€¢ 20261116130000_enquiry_sequence_privileges.sql
 â€¢ 20261116130100_optional_enquiry_email.sql
```

The preview listed exactly the two approved pending files, in order. Reviewed SQL contains no DROP/TRUNCATE/reset or data deletion; sequence REVOKE and the reviewed CREATE OR REPLACE FUNCTION are intentional.

## Deployment

```powershell
npx --offline supabase@3.1.0 db push --remote=fszrsispjxunckknphaw --skip-vault --yes --output-format text
```

The cached executable for this same CLI installation was invoked with argument arrays, avoiding shell path quoting problems. Target and draft hashes were rechecked immediately before execution. Exit code: **0**. No repair or manual ledger manipulation.

stdout:
```text
Finished supabase db push.
```
stderr:
```text
Target: project VisionTech-Staging (fszrsispjxunckknphaw) Â· production
Initialising login role...
Confirmed by --yes: Apply 2 migrations on project VisionTech-Staging (fszrsispjxunckknphaw) Â· production
Applying migration 20261116130000_enquiry_sequence_privileges.sql...
Applying migration 20261116130100_optional_enquiry_email.sql...
```

## Actual remote ledger

```text
202611120001
202611120002
20261112170000
20261116130000
20261116130100
```

## Object and permission verification

Sequence owner: postgres. Final ACL:

```text
{postgres=rwU/postgres}
```

All nine has_sequence_privilege checks returned false: SELECT, UPDATE and USAGE for each of anon, authenticated and service_role. The sequence owner retains access. Recorded catalog dependency remains schema public; the RPC's nextval call is a textual PL/pgSQL dependency checked in its body.

submit_public_enquiry remains owned by postgres, SECURITY DEFINER, with search_path=pg_catalog, public, auth, pg_temp. Its body hash matches the applied optional-email SQL. Its EXECUTE ACL remains service_role/postgres only. Every other public function's body, execution privileges, definer flag and settings match the pre-deployment snapshot.

Before/after comparisons found unchanged application relations, columns, constraints, indexes, policies, ordinary triggers, enums and extensions. All ten tables retain RLS. The 22 indexes, 32 constraints (including 11 foreign keys), ten policies and three application triggers remain. Direct table/column ACLs were independently compared and are unchanged. This is the inspected application/catalog scope, not a claim of a full audit of all Supabase-managed internals.

## Hosted security tests

The existing suites were reviewed again before hosted execution. They contain BEGIN/ROLLBACK, synthetic data and no COMMIT. The second file is marked local-only by default; its hosted execution was separately reviewed for this approved verification: the application fixture baseline was empty and all nine sequence privileges were confirmed false before running any nextval/setval denial test. No sequence reset was attempted.

Original test files were left unchanged. External output-capture wrappers insert the existing plan/assertion/finish results into a transaction-local temporary table, reset role for the final aggregate SELECT and retain ROLLBACK. Only temporary output-table INSERT/SELECT grants were introduced, within the rolled-back transaction. The SQL query interface was used because the prior Docker runner had an extensions-schema permission issue and the unwrapped query interface exposes only the last nonempty result. No permanent test grant or pgTAP installation was retained.

Exact hosted invocation pattern:

```powershell
supabase.exe db query --remote=fszrsispjxunckknphaw --yes --file <external reviewed output-capture SQL>
```

Both executions exited 0. Actual returned TAP output:

### 001_rls_security_test.sql

```text
1..21
ok 1 - anonymous can read published products only
ok 2 - anonymous cannot read profiles
ok 3 - anonymous cannot read enquiries
ok 4 - anonymous cannot read private notes
ok 5 - anonymous cannot read activity
ok 6 - anonymous cannot read notifications
ok 7 - anonymous cannot read email outbox
ok 8 - staff sees assigned enquiry only
ok 9 - staff sees notes for assigned enquiry only
ok 10 - staff sees own notifications only
ok 11 - staff sees assigned enquiry event and own actor event only
ok 12 - staff cannot modify profile role directly
ok 13 - staff cannot update product records
ok 14 - admin can read all enquiries
ok 15 - admin can read hidden and published products
ok 16 - admin can update product data through the authorized RPC
ok 17 - anonymous role cannot execute staff administration RPC
ok 18 - authenticated role cannot execute service-only staff administration RPC
ok 19 - admin cannot elevate a staff account
ok 20 - failed admin escalation leaves the staff role unchanged
ok 21 - super administrator can grant an administrator role
```

### 002_enquiry_api_security_test.sql

```text
1..18
ok 1 - anon cannot advance sequence
ok 2 - anon cannot modify sequence
ok 3 - anon cannot read sequence
ok 4 - authenticated cannot advance sequence
ok 5 - authenticated cannot modify sequence
ok 6 - authenticated cannot read sequence
ok 7 - backend cannot directly advance sequence
ok 8 - backend cannot directly modify sequence
ok 9 - backend cannot directly read sequence
ok 10 - service RPC creates enquiry through owner sequence privileges
ok 11 - absent email stored as empty text
ok 12 - new status preserved
ok 13 - transaction created outbox
ok 14 - idempotent retry created no duplicate
ok 15 - supplied invalid email still rejected in database
ok 16 - RLS preserved
ok 17 - anonymous still cannot execute service RPC
ok 18 - authenticated still cannot execute service RPC
```

## HTTP verification without email

An external copy of services/tests/staging-enquiry.mjs omitted the email property from the submitted payload and checked that customer_email was stored as empty text. Only imports/fixture expectation were adjusted; production API code was unchanged. The test guarded the configured and linked staging reference, used random idempotency keys and a synthetic marker, disabled actual email sending in memory, and used a fresh process-only rate hash secret.

Actual checks passed: health connectivity, 201 accepted save without email, 200 retry with the same enquiry code, exact normalized customer/model/message fields, SQL-looking message stored as data, FAILED outbox when mail was intentionally unavailable, five permitted submissions, sixth distinct submission rejected with 429, anonymous Data API denied enquiries access, and scoped cleanup of enquiries/activity/notifications/outbox/rate bucket. No raw upstream error or credential was printed. The prior with-email staging test remains recorded in ENQUIRY_API_TEST_REPORT.md; a with-email HTTP run was not repeated in this deployment turn. Database rejection of malformed supplied email was retested in assertion 15 of the new suite.

The expected 429 emitted a redacted structured error log. This was a passing rate-limit test, not a deployment failure.

## Cleanup and final checks

Final read-only aggregate results:

| Object | Count/state |
| --- | --- |
| admin_activity | 0 |
| admin_notifications | 0 |
| auth_users | 0 |
| email_outbox | 0 |
| enquiries | 0 |
| enquiry_notes | 0 |
| pgtap_installed | False |
| products | 0 |
| profiles | 0 |
| service_content | 0 |
| site_settings | 1 |
| storage_buckets | 0 |
| storage_objects | 0 |
| submission_rate_limits | 0 |

All synthetic Auth users and application data are absent. site_settings=1 is the original seed. pgTAP is not retained. Catalog snapshots after tests match the immediate post-deployment snapshot. No permanent harness object or temporary grant remains. The SQL RPC test and five HTTP saves legitimately consumed sequence values; sequence gaps are normal and were not rewound. No reset/drop or broad cleanup operation was used.

.env remains ignored and untracked. All five migration hashes are unchanged. Only documentation was updated in the project during this deployment turn; pre-existing implementation changes and untracked files were preserved. No new administrator account exists as a result of these tests.

## Evidence and queries

Evidence directory (outside Git):

`C:\Users\LEGION\Documents\Codex\2026-11-13\p0-02b-disposable-local-supabase-migration`

Files: backend-deploy-before-catalog.json, backend-deploy-before-counts.json, backend-deploy-before-sequence.json, backend-deploy-dry-run.json, backend-deploy-result.json, backend-deploy-after-catalog.json, backend-deploy-after-sequence.json, backend-deploy-privileges.json, backend-deploy-test-001_rls_security_test.sql.json, backend-deploy-test-002_enquiry_api_security_test.sql.json, backend-deploy-final-counts.json, backend-deploy-final-catalog.json, backend-deploy-final-acls.json. External capture SQL and backend-deploy-optional-email.mjs are retained for reproducibility. HTTP output was observed in the execution transcript.

Read-only SQL files used: p004-catalog.sql, p005-counts.sql, prompt5-sequence-review.sql, p005-acls.sql and backend-deploy-privileges.sql. Each was executed with the explicit staging reference and --read-only. Core checks:

```sql
select version from supabase_migrations.schema_migrations order by version;
select pg_get_userbyid(relowner), relacl
from pg_class where oid='public.enquiry_number_seq'::regclass;
select role,
  has_sequence_privilege(role,'public.enquiry_number_seq','SELECT') as can_read,
  has_sequence_privilege(role,'public.enquiry_number_seq','UPDATE') as can_set,
  has_sequence_privilege(role,'public.enquiry_number_seq','USAGE') as can_use
from unnest(array['anon','authenticated','service_role']) as role;
select pg_get_userbyid(proowner), prosecdef, proconfig, proacl, md5(prosrc)
from pg_proc where oid='public.submit_public_enquiry(jsonb,uuid,text)'::regprocedure;
```

## Remaining scope

The two approval-dependent database blockers from Prompt 5 are resolved on staging. Real email delivery, complete admin login/staff workflows, disabled-account policy coverage, production hosting and broader operational readiness remain outside this deployment verification. Global defaults for future sequences were intentionally not changed; future migrations must set appropriate explicit ACLs. No production readiness claim is made.

**BACKEND MIGRATIONS DEPLOYED AND VERIFIED ON STAGING.**

## Final local review — 2026-11-18

Resumed after the automatic approval review usage-limit interruption. The final local check completed successfully: git diff --check passed, all five migration SHA-256 hashes still match the approved values, and the deployment report exists with the recorded results. Existing uncommitted project changes were preserved. No migration was reapplied, no new remote database request was made during this final local review, and no commit, push or website deployment occurred. Hosted test and cleanup evidence above is from the completed 2026-11-16 verification.
