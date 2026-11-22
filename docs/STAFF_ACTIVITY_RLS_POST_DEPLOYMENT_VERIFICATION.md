# Staff activity RLS post-deployment verification

Date: 2026-11-22 (Asia/Calcutta).

**Result: PASS for the focused database authorization checks — 33/33 staging assertions passed on the final run, and all disposable records were rolled back.** Five existing local staff unit tests also passed. No browser login or live HTTP/JWT authentication round trip was performed.

## Target and inspected implementation

- Project: VisionTech-Staging, reference `fszrsispjxunckknphaw`.
- Local link matched the required reference; CLI responses independently identified that exact project. CLI v3.1.0 was used. Its `production` label refers to the default branch of this staging project, not another production project.
- Migration: `20261122000100_staff_activity_access.sql`.
- SHA-256 unchanged: `E8580798304C7DB4D3E4AFCDD4C693F83D610E499F7564B9DEE73048AA8EBC79`.
- All six migration hashes match the preceding review/deployment records. Remote ledger contains the five prior versions plus `20261122000100`.
- Read: deployment report, `ROLE_BASED_ACCESS_CONTROL.md`, current permissions, staff-service, staff-routes, auth modules, existing SQL security suites and staff unit tests.
- Current API verifies the Supabase user and ACTIVE profile before private access. Route permissions restrict staff management to ADMIN/SUPER_ADMIN; mutation validation prevents self-edits/protected targets and uses the existing service-only `admin_set_staff` RPC. Staff activity reads use the user's token. The database RPC independently checks actor state/role, allowed targets and role escalation, and writes audit records transactionally.
- Documentation discrepancy: `ROLE_BASED_ACCESS_CONTROL.md` still has a historical “Pending RLS restriction — not deployed” section. Current remote evidence and the deployment report supersede it. That document was not changed in this focused verification.

## Method, isolation and safety

The remote preflight inspected live policies, staff RPC definition and every non-internal trigger on fixture tables (auth.users, profiles, enquiries, admin_activity). Only ordinary transactional database writes were present; no external network/email call was found in these trigger functions.

Four disposable Auth rows were inserted directly inside a PL/pgSQL exception subtransaction: one SUPER_ADMIN, one ADMIN and two STAFF identities. They had reserved `example.invalid` emails, no configured passwords, no provider login and no sessions. Their IDs end in 1–4 under prefix `7a220001-0000-4000-8000-`. Two disposable enquiries use prefix `7a220002`; five activity fixtures plus a temporary service-write fixture use prefix `7a220003`.

The tests execute `SET LOCAL ROLE authenticated` and set transaction-local request subject/role claims to these identities. These are real staging database RLS queries under the non-bypass authenticated role. They do not prove provider token issuance/signature validation, browser cookies or API transport. Service-role tests explicitly switch to `service_role`, including with a disabled subject, to test the actual bypass and RPC authorization behavior separately.

All fixture writes, Auth/profile trigger effects, staff RPC changes, enquiry-trigger activity, dashboard notifications and email-outbox rows occur in one exception subtransaction. The test intentionally raises and catches SQLSTATE `P7R01` after recording results, rolling back that entire subtransaction. An unexpected error also rolls it back and is recorded as a failed test. Results survive in PL/pgSQL variables and are returned through a transaction-local custom setting. No temporary functions, extensions, policies or tables were created. No migration was injected into the test: it exercised the already deployed policy.

Outbox/notification rows were never committed and therefore unavailable to normal workers. Enquiry codes were supplied explicitly, avoiding the non-transactional enquiry-number sequence. Existing rows were not used as fixtures. The baseline was zero rows in all six inspected data tables. Independent read-only queries after both runs verified that baseline was restored.

## Exact staging test results

Final run: **33 planned, 33 executed, 33 passed, 0 failed, 0 unexecuted**. CLI command exit code 0; `fixture_subtransaction_rolled_back=true`.

Fixture activity IDs ending 1 and 2 represent STAFF A's own activity and an event by STAFF B for an enquiry assigned to STAFF A. IDs ending 3–5 are another staff member's assigned-enquiry event, unrelated staff activity, and unrelated system activity. Exact ID-array assertions verify both allowed access and exclusion of every other fixture, rather than relying on counts alone.

| # | Assertion | Expected | Actual | Result |
| --- | --- | --- | --- | --- |
| 1 | Staff test executes as non-bypass authenticated role | "authenticated" | "authenticated" | PASS |
| 2 | Active staff helper is true | true | true | PASS |
| 3 | Active staff sees exact own and assigned-enquiry fixture IDs | ["7a220003-0000-4000-8000-000000000001","7a220003-0000-4000-8000-000000000002"] | ["7a220003-0000-4000-8000-000000000001","7a220003-0000-4000-8000-000000000002"] | PASS |
| 4 | Active staff sees assigned automatic ENQUIRY_CREATED event | 1 | 1 | PASS |
| 5 | Authenticated staff cannot call service-only staff RPC | "42501" | "42501" | PASS |
| 6 | Staff cannot update profile role directly | "42501" | "42501" | PASS |
| 7 | Disabled staff active helper is false | false | false | PASS |
| 8 | Disabled staff role helper returns null | true | true | PASS |
| 9 | Disabled staff sees zero total activity rows | 0 | 0 | PASS |
| 10 | Disabled staff cannot read own historical activity | 0 | 0 | PASS |
| 11 | Disabled staff cannot read previously assigned-enquiry activity | 0 | 0 | PASS |
| 12 | Active ADMIN retains all five fixture activity records | 5 | 5 | PASS |
| 13 | Active ADMIN retains both enquiry reads | 2 | 2 | PASS |
| 14 | Authenticated ADMIN cannot bypass service-only staff RPC | "42501" | "42501" | PASS |
| 15 | Active SUPER_ADMIN retains all five fixture activity records | 5 | 5 | PASS |
| 16 | Service-role test executes as service_role | "service_role" | "service_role" | PASS |
| 17 | Service role retains all fixture activity even with disabled subject | 5 | 5 | PASS |
| 18 | Service role can insert activity with disabled subject | 1 | 1 | PASS |
| 19 | Service role can update fixture activity | true | true | PASS |
| 20 | Service role can delete its disposable activity | 0 | 0 | PASS |
| 21 | ADMIN cannot promote STAFF to ADMIN | "P0001" | "P0001" | PASS |
| 22 | Rejected promotion leaves role STAFF | "STAFF" | "STAFF" | PASS |
| 23 | STAFF actor cannot administer another account through RPC | "P0001" | "P0001" | PASS |
| 24 | SUPER_ADMIN target remains protected | "P0001" | "P0001" | PASS |
| 25 | Authorized ADMIN can reactivate STAFF | "ACTIVE" | "ACTIVE" | PASS |
| 26 | Authorized ADMIN can edit STAFF details | "Activated Staff" | "Activated Staff" | PASS |
| 27 | Authorized ADMIN can deactivate STAFF | "DISABLED" | "DISABLED" | PASS |
| 28 | Authorized SUPER_ADMIN can promote STAFF | "ADMIN" | "ADMIN" | PASS |
| 29 | Authorized staff mutations create three audit events | 3 | 3 | PASS |
| 30 | Reactivated staff regains only original permitted fixture scope | ["7a220003-0000-4000-8000-000000000001","7a220003-0000-4000-8000-000000000002"] | ["7a220003-0000-4000-8000-000000000001","7a220003-0000-4000-8000-000000000002"] | PASS |
| 31 | Disabled ADMIN cannot read historical staff-management audit | 0 | 0 | PASS |
| 32 | Service-only RPC rejects disabled administrator actor | "P0001" | "P0001" | PASS |
| 33 | Anonymous activity read remains forbidden | "42501" | "42501" | PASS |

SQLSTATE `42501` denotes expected insufficient privilege. SQLSTATE `P0001` is the existing RPC's expected authorization rejection. These expected denials passed; they are not operational test failures.

## First-run failure and correction

The first run executed all 33 assertions: 32 passed and 1 failed. Assertion 8, “Disabled staff role helper returns null,” reported actual null and expected null but failed because the scratch harness compared SQL NULL from `to_jsonb(NULL)` with the JSONB literal `null`. Those are distinct SQL values.

This was a test-harness defect, not an observed access-control failure. The raw first-run result and SQL were preserved. The assertion was corrected to evaluate `public.current_admin_role() IS NULL` and expect boolean true. No application code, helper, policy or migration was changed. Cleanup and unchanged catalog were independently confirmed before rerunning. The corrected full run passed all 33 assertions, including that explicit null check.

## Existing local application tests

Executed without loading the project .env:

`node --test 'C:\Vision Tech\services\tests\staff.test.mjs'`

Result: **5 tests, 5 passed, 0 failed, 0 skipped, exit code 0**:

1. Permission matrix prevents self-edits and protects every Super Admin.
2. Central private-route matrix limits operational/business-wide features.
3. Invitation state distinguishes missing, malformed, completed and expired states.
4. Typed staff inputs reject markup, objects and privileged role requests.
5. Unconfigured invitation delivery stops before Auth access.

These are local unit tests, not remote HTTP integration tests. The invitation test explicitly disables its in-memory configuration and stops before any Auth call. No invitation was sent.

## Independent cleanup and unchanged definitions

After the first run and again after the final run, an independent read-only query returned the following total table counts:

| Table | Before | After final run | Result |
| --- | --- | --- | --- |
| activity | 0 | 0 | PASS |
| enquiries | 0 | 0 | PASS |
| notifications | 0 | 0 | PASS |
| outbox | 0 | 0 | PASS |
| profiles | 0 | 0 | PASS |
| users | 0 | 0 | PASS |

Here users = auth.users; all other tables are public schema tables (notifications = admin_notifications, outbox = email_outbox). Zero total rows confirms no fixtures remain, including trigger/RPC-generated records. No cleanup DELETE of real records was needed.

The normalized preflight and after snapshots were exactly equal, including migration versions, activity policy definitions, staff RPC body and the inspected trigger definitions/functions. The permissive activity policy and restrictive active-account policy both remain intact. This is a scoped object comparison, not an exhaustive whole-database schema diff. No policy DDL, migration command, hosted Auth/email settings update, production action, application edit, Git commit or push was executed.

## Commands and retained evidence

The cached CLI executable was:

`C:\Users\LEGION\AppData\Local\npm-cache\_npx\a2642d082f752488\node_modules\@supabase\cli-windows-x64\bin\supabase.exe`

Read-only pre/post command arguments:

`db query --remote=fszrsispjxunckknphaw --read-only --file <absolute scratch path>/staff-activity-post-preflight.sql --output-format json --workdir 'C:\Vision Tech'`

Disposable fixture command arguments (the user's authorization includes temporary writes; rollback is built into the SQL):

`db query --remote=fszrsispjxunckknphaw --file <absolute scratch path>/staff-activity-post-tests.sql --output-format json --workdir 'C:\Vision Tech' --yes`

The CLI printed the correct staging name/reference and “Confirmed by --yes: Run a SQL statement…”; both test invocations exited 0. Assertion results were checked independently of the CLI exit code. The only CLI notice was that v3.2.0 is available; no upgrade was performed.

Evidence directory outside the project:

`C:\Users\LEGION\Documents\Codex\2026-11-13\p0-02b-disposable-local-supabase-migration`

- `staff-activity-post-before.json`, `staff-activity-post-after-first.json`, `staff-activity-post-after.json`: preflight/cleanup and catalog evidence.
- `staff-activity-post-results-first.json`, `staff-activity-post-tests-first.sql`: preserved initial run.
- `staff-activity-post-results.json`, `staff-activity-post-tests.sql`: corrected final run and exact executed SQL.
- `staff-activity-post-preflight.sql`: exact read-only query.
- Scratch generator `build-staff-post-tests.mjs`: test construction only, outside application source.

Final executed test SQL SHA-256: `971D62B1F8D1AE441C21D3A18EF01B5EDA33EC9F2C632163E0773DB16A9BBA08`.

## Limits and conclusion

The deployed activity policy is verified against actual staging rows and SQL roles: active staff retain precisely scoped access, disabled staff cannot read any activity including their own historical rows, admins retain access, authorized staff-management RPCs work and audit changes, unauthorized mutations are denied, and service-role read/write operations are not blocked.

Not performed: actual hosted Auth sign-in/token verification, browser/dashboard interaction, live API HTTP staff-update/session-revocation flows, invitation/recovery delivery, load/performance/concurrency tests, and rerunning all older pgTAP suites. Those are separate from this focused database-policy verification; no result is claimed for them. Provider credentials and .env values were not accessed or printed by the test harness.

Only this new report was added to the project during this task. Existing untracked review/deployment reports were preserved. All fixtures were removed by rollback, and no database definition or application file was changed.

**Focused post-deployment RLS verification passed; cleanup independently verified.**
