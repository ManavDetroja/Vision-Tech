# Supabase Migration Preflight Report

**Date:** 2026-11-13
**Scope:** Original static SQL review plus the disposable-local compatibility test documented in [SUPABASE_LOCAL_MIGRATION_TEST_REPORT.md](SUPABASE_LOCAL_MIGRATION_TEST_REPORT.md). No remote Supabase endpoint was contacted, no remote migration was applied, and no original migration file was modified or renamed.

## Executive finding

**READY FOR STAGING MIGRATION REVIEW.** On Supabase CLI 3.1.0, both original 12-digit versions and the 14-digit version were listed against a disposable local stack, the three migrations applied in order, the Auth trigger produced the intended disabled staff profile for a synthetic user, and the corrected 21-assertion pgTAP suite passed. This is readiness for a human staging migration review only; it is not authorization to apply migrations. See the local test report for exact results and the test expectation correction.

## Baseline and scope

The owner supplied read-only staging inspection results: the `supabase_migrations` schema was absent; no application tables were present in `public`; the RLS inspection returned no public tables; remote migration history was unavailable; and no migrations were applied during that verification. These are owner-supplied observations, not independently queried in this milestone. Absence of public tables and a migration ledger does not establish that no user-defined functions, types, triggers, extensions, or manually created schema objects exist.

This review read the complete contents of all three local migration SQL files and the 21-assertion pgTAP file. No SQL was executed.

## Migration inventory

| Order | Local filename / version | Size | Purpose and principal objects |
|---:|---|---:|---|
| 1 | `202611120001_secure_admin.sql` / `202611120001` | 33,423 bytes; 550 lines | Installs `pgcrypto` if absent; four enums; `enquiry_number_seq`; ten application tables; indexes; authorization, enquiry, dashboard, product, service, settings, notification, email-delivery, and staff RPC functions; two triggers; RLS and grants. |
| 2 | `202611120002_enquiry_lifecycle.sql` / `202611120002` | 8,144 bytes; 150 lines | Evolves enquiry statuses and lifecycle fields; adds follow-up support/index; replaces staff, status-update and dashboard functions; updates activity policy. |
| 3 | `20261112170000_security_hardening.sql` / `20261112170000` | 5,434 bytes; 105 lines | Adds enquiry `updated_at` and timestamp trigger; hardens `SECURITY DEFINER` search paths; restricts staff-role management. |

### Migration 1 object inventory

- **Types:** `admin_role`, `account_state`, `enquiry_status` (initially includes `RESOLVED`), `enquiry_type`.
- **Sequence:** `enquiry_number_seq`.
- **Tables (creation/dependency order):** `profiles`; `enquiries`; `enquiry_notes`; `admin_notifications`; `email_outbox`; `admin_activity`; `submission_rate_limits`; `products`; `service_content`; `site_settings`.
- **Indexes:** enquiry creation/status/assignee indexes; enquiry-note lookup; unread-notification lookup; activity chronology; rate-limit window.
- **Triggers:** `auth_user_profile_created` on managed `auth.users`, invoking a function that creates a disabled profile; `enquiry_created_events` on `public.enquiries`.
- **Functions (19):** `current_admin_role`, `is_active_account`, `create_disabled_profile`, `on_enquiry_created`, `submit_public_enquiry`, `admin_update_enquiry_status`, `admin_assign_enquiry`, `admin_add_enquiry_note`, `admin_delete_enquiry`, `admin_dashboard_stats`, `admin_mark_notification_read`, `record_own_login`, `admin_update_product`, `admin_create_product`, `admin_update_service`, `admin_update_site_settings`, `public_contact_settings`, `admin_set_email_delivery`, `admin_set_staff`.
- **Policies:** RLS is enabled on all ten application tables. Ten policies cover self/admin profile access; admin or assigned-staff enquiry/note access; recipient-owned notification reads/updates; admin email-outbox reads; actor/admin activity reads; visible catalogue/service reads (admins can see hidden content); and super-admin settings access.
- **Grants:** broad table grants to `anon` and `authenticated` are revoked, with limited read/update/RPC grants restored where needed. Privileged service operations such as public enquiry submission, email delivery updates, and staff setup are restricted to `service_role`.
- **Seed data:** one default `site_settings` row is inserted with conflict protection. The super-admin bootstrap SQL is commented out and does not create an account.

### Migration 2 changes

- Conditionally renames enum value `RESOLVED` to `CLOSED` when `CLOSED` is not present and adds `CONVERTED` when absent.
- Adds `converted_at`, `closed_at`, and `follow_up_at` to `enquiries`; backfills `closed_at` from `resolved_at` for closed records; creates a follow-up index.
- Replaces `admin_set_staff`, `admin_update_enquiry_status`, and `admin_dashboard_stats`; adds `admin_set_enquiry_follow_up`; replaces the activity-read policy to include assigned-staff activity.
- Retains service-role-only staff administration and grants the follow-up RPC to intended authenticated roles.

### Migration 3 changes

- Adds `enquiries.updated_at`, a `touch_enquiry_updated_at` trigger function, and the `enquiries_touch_updated_at` trigger.
- Replaces `admin_set_staff` so administrators can manage staff but cannot promote staff to administrator or alter a super-admin; the super-admin restriction is enforced in the database function.
- Sets a fixed hardened search path (`pg_catalog, public, auth, pg_temp`) on the existing `SECURITY DEFINER` functions and reapplies the intended service-role-only staff RPC grant.

## Dependency and foreign-key order

Required migration order is **M1 → M2 → M3 → pgTAP verification**. M2 assumes the M1 enums, tables, columns, policies, and functions. M3 assumes the M1/M2 functions and lifecycle schema, including `admin_set_enquiry_follow_up`. Do not expose or activate admin functionality during a partial rollout after M1 or M2; the most restrictive staff-role implementation is introduced in M3.

Foreign keys reviewed:

| Child reference | Parent | Delete behavior | Ordering implication |
|---|---|---|---|
| `profiles.id` | managed `auth.users.id` | CASCADE | Requires Supabase Auth schema and table. |
| `enquiries.assigned_to` | `profiles.id` | SET NULL | `profiles` before `enquiries`. |
| `enquiry_notes.enquiry_id` | `enquiries.id` | CASCADE | `enquiries` before notes. |
| `enquiry_notes.author_id` | `profiles.id` | RESTRICT | Profiles before notes. |
| `admin_notifications.recipient_id` | `profiles.id` | CASCADE | Profiles before notifications. |
| `admin_notifications.enquiry_id` | `enquiries.id` | SET NULL | Enquiries before notifications. |
| `email_outbox.enquiry_id` | `enquiries.id` | CASCADE | Enquiries before outbox. |
| `admin_activity.actor_id` | `profiles.id` | SET NULL | Profiles before activity. |
| `products.updated_by` | `profiles.id` | SET NULL | Profiles before products. |
| `service_content.updated_by` | `profiles.id` | SET NULL | Profiles before services. |

The declared creation order satisfies these dependencies. No broken local FK target was identified. The `auth.users` dependency means the migrations are Supabase-specific and cannot initialize in a plain PostgreSQL database without Supabase Auth objects and roles.

## Security and RLS review

- RLS is enabled on every application table created by M1. Public-facing data is limited to visible products/services and the explicit contact-settings RPC; customer and staff records are scoped to roles, assignment, recipient, or actor as designed in the policies.
- Direct table writes are generally revoked in favor of controlled RPC functions. Some read/update policies rely on `current_admin_role()` / `is_active_account()` and database role context; these must be tested under actual `anon`, `authenticated`, and service-role execution contexts.
- M1 and M2 `admin_set_staff` implementations have an intermediate privilege escalation weakness: an administrator can assign the admin role to a non-super-admin target, and M1 lacks adequate protection against manipulating a super-admin target. M3 tightens the function. Apply and review the complete chain before granting staff access or exposing the API.
- M1's Auth trigger attaches to `auth.users`. It creates disabled profile rows; it does not create users. However, the migration drops/recreates its named trigger on a Supabase-managed table. This is a managed-schema change that needs explicit staging approval/review even though the table's columns and existing user rows are not modified by this SQL.
- M1 conditionally installs `pgcrypto`; if absent, that changes extension catalog state. Confirm the expected extension schema/state during staging review.
- The policies and grants were statically inspected only. Runtime authorization has not been verified against a database.

## Destructive and idempotency review

- No migration contains `DROP TABLE`, `DROP SCHEMA`, `TRUNCATE`, or a top-level deletion of customer/application records.
- M1 uses `CREATE ... IF NOT EXISTS`, conflict-safe settings insertion, and drops/recreates named triggers and policies. These constructs are repeat-tolerant in part, but they are not a substitute for a migration ledger: `CREATE TABLE IF NOT EXISTS` does not validate an existing table's shape, and duplicate enum handling does not verify that existing enum labels match the expected definition.
- M2 conditionally changes enum labels and adds columns/indexes. It is not safe to rerun blindly as an arbitrary SQL script; its assumptions and partial-application state must be checked.
- M3 uses `ADD COLUMN IF NOT EXISTS` and replaces functions/triggers. It also is not a substitute for migration-history reconciliation.
- Runtime deletion exists inside functions: public submission removes expired rate-limit buckets; the admin enquiry delete RPC removes an enquiry and dependent rows according to FK cascades. These are runtime operations, not migration-time deletes, but their authorization and retention behavior should be tested separately.
- Migration files modify schema and functions but do not create migration-history schemas/tables manually.

## pgTAP readiness

`supabase/tests/001_rls_security_test.sql` contains `plan(21)` and wraps test fixtures in `BEGIN`/`ROLLBACK`. It creates `extensions.pgtap` if absent, inserts synthetic rows into `auth.users` and application tables, switches among `anon`, `authenticated`, and `service_role`, and asserts access boundaries, public product reads, role escalation denial, and super-admin protection.

The test directly inserts synthetic Auth users, so it must only run against a disposable local database or another explicitly approved isolated test database. It does not cover every policy/function (including all deletion, outbox, rate-limit, and notification paths); passing it is not full security certification. The disposable-local run and one incorrect expected activity count are documented in the local test report.

## Filename compatibility analysis

The two first versions are 12 digits (`YYYYMMDDHHmm`): `202611120001` and `202611120002`. The third is 14 digits (`YYYYMMDDHHmmss`): `20261112170000`. All are unique and their numeric values imply M1 then M2 then M3. Current Supabase migration conventions use a timestamp prefix followed by an underscore and name, but compatibility of these exact mixed-width versions with CLI **3.1.0** has not been demonstrated. Existing CLI documentation and issue history show that migration parsing/display and ordering have had edge cases for nonstandard timestamp widths; that evidence does not prove these exact versions fail, nor that they pass.

**Do not rename them now.** A rename changes the migration version identity. If any SQL was applied outside the absent ledger, a new filename could cause duplicate execution. Recommended future convention: use unique 14-digit UTC timestamp prefixes for new migrations. For historical files, first test parser/list behavior on a disposable local project using the installed CLI, then reconcile schema state and ledger in a separate approved staging plan. Preserve the original SQL and record any approved mapping; do not silently rewrite versions.

## Recommended migration execution sequence

1. Confirm the hosted project reference against the Supabase Dashboard for `VisionTech-Staging`; do not infer identity solely from a local CLI label.
2. On a disposable local Supabase instance, verify CLI 3.1.0 recognizes all three filenames and reports the intended order. Apply the files locally only in that disposable environment, then run the pgTAP suite and inspect resulting schema/grants/policies. This preflight task did not do so.
3. Resolve the mixed-width filename question and document the canonical migration version mapping before any staging operation. Do not rename or edit these historical files until then.
4. Review and explicitly approve the `auth.users` trigger and `pgcrypto` extension effects for staging.
5. Confirm staging's schema/type/function/trigger/extension state and migration ledger using read-only inspection. The supplied public-table baseline alone cannot rule out manually created objects or prior SQL execution.
6. In a separate milestone, prepare and review an exact staging-only migration plan. Apply only after explicit authorization and a verified project identity; then verify schema, policies, grants, and migration ledger.

## Risks and unresolved questions

1. The supplied staging baseline does not independently establish the hosted project identity or inventory non-table objects/manual schema changes.
2. M1 changes a Supabase-managed Auth trigger; staging change ownership/approval still needs to be explicit even though local trigger behavior passed.
3. M1/M2 staff role-management functions are less restrictive until M3 is applied; staging review must preserve the complete order and avoid exposing the application part-way through.
4. Idempotent syntax does not make partial or repeated execution safe when objects already exist with incompatible shapes or enum labels.
5. Passing the current 21 pgTAP assertions does not cover every policy/function or establish production security.

## Recommendation

**READY FOR STAGING MIGRATION REVIEW.** Keep all original migration filenames and SQL unchanged. Before any later apply decision, verify the exact staging project identity and full schema/object baseline, review the `auth.users` trigger and `pgcrypto` extension effects, and prepare a separately approved execution plan. This result does not authorize staging or production changes.

## Disposable-local test addendum (2026-11-13)

- Supabase CLI **3.1.0** recognized versions `202611120001`, `202611120002`, and `20261112170000` against the local stack. The 12-digit versions were displayed as raw version strings; the 14-digit version parsed as `2026-11-12 17:00:00`. Migration history showed the exact three versions applied in numeric dependency order.
- Temporary 14-digit copies `20261112000100_secure_admin.sql` and `20261112000200_enquiry_lifecycle.sql` parsed as `2026-11-12 00:01:00` and `00:02:00`. The CLI then showed the original 12-digit versions missing locally and the temporary 14-digit versions pending. This demonstrates why historical files must not be renamed without a matching migration-history plan.
- All three original SQL files were copied byte-for-byte to the disposable directory; their SHA-256 hashes matched the originals after the test. No original migration file was edited or renamed.
- Initial local execution of the original pgTAP suite reported **20/21** passing. Assertion 11 expected one activity record, but the enquiry insert trigger creates an activity record and the test then inserts a second manual record for the same assigned enquiry/actor. Both are correctly visible to the assigned staff member; the other staff member's record is not visible. The repository pgTAP test expectation was corrected from 1 to 2, and the rerun passed **21/21**. This was a test expectation correction; no migration SQL changed.
- A synthetic local Auth user received exactly one `STAFF` / `DISABLED` profile. A conflict-safe duplicate insert created no extra Auth/profile row; an unguarded duplicate Auth insert raised a unique violation and left the profile intact. The entire trigger check ran in a transaction and was rolled back.
- The local catalog contained 10 public tables, all 10 with RLS enabled, 10 policies, 22 indexes, 21 public functions, and three non-internal triggers including the Auth trigger. The `create_disabled_profile` and final `admin_set_staff` functions were `SECURITY DEFINER` with `search_path=pg_catalog, public, auth, pg_temp`. `admin_set_staff` and `submit_public_enquiry` had execute grants for `service_role` (and postgres), not anon/authenticated.
- Only the disposable project was stopped with its project-specific ID and `--no-backup`; its containers and data volumes were removed. Recursive deletion of the two temporary working directories was rejected by the execution policy even after their resolved paths were checked. Their file inventory contains only copied config/migration/test files and CLI metadata; no `.env` was copied. The unrelated existing Docker container was not stopped or modified. No staging or production endpoint was contacted.
- The CLI's normal local startup summary emitted generated local development key values to its tool output. They were not copied into project files or reports and were not remote credentials; the disposable stack and volumes were removed after testing.
