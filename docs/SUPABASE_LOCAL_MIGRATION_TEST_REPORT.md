# Supabase Local Migration Test Report

**Date:** 2026-11-13
**Project:** `C:\Vision Tech`
**CLI:** Supabase CLI 3.1.0
**Conclusion:** **READY FOR STAGING MIGRATION REVIEW** (not approval to apply)

## Scope and isolation

The test used a temporary copy under the Windows temporary directory with `supabase/config.toml`, the three migration files, and the pgTAP test only. The copied config used the unique local project ID `visiontech-p0-02b-disposable-20261113`; it had no `.env`, no remote project reference, and no linked project cache. Commands used explicit temporary `--workdir` paths and local targets. No `--remote`, `db push`, remote repair, staging, or production operation was used.

The Supabase CLI started the local Postgres/Auth/API stack. On the first start attempt, an over-broad optional-service exclusion also excluded Kong and caused the local REST readiness check to fail after all three migrations had applied. The stack was restarted with the required local services; it became healthy and the remaining tests completed. This was a local service readiness issue, not a migration SQL failure.

## Filename compatibility

| Original filename | Version | CLI 3.1.0 result | Local order |
|---|---|---|---:|
| `202611120001_secure_admin.sql` | `202611120001` (12 digits) | Recognized; displayed as raw version string | 1 |
| `202611120002_enquiry_lifecycle.sql` | `202611120002` (12 digits) | Recognized; displayed as raw version string | 2 |
| `20261112170000_security_hardening.sql` | `20261112170000` (14 digits) | Recognized and parsed as `2026-11-12 17:00:00` | 3 |

`supabase migration list` targeted `127.0.0.1:54322` and reported these exact three local versions in the applied local history. CLI startup also reported applying the three original migration filenames in order.

### Temporary 14-digit naming experiment

Only temporary copies were renamed:

- `202611120001_secure_admin.sql` → `20261112000100_secure_admin.sql`
- `202611120002_enquiry_lifecycle.sql` → `20261112000200_enquiry_lifecycle.sql`
- The existing 14-digit third filename remained unchanged.

Both experimental versions parsed as timestamps (`00:01:00` and `00:02:00`) and sorted before `20261112170000`. Against the local history containing the original versions, the list showed the 12-digit entries unmatched in local files and the 14-digit versions as pending. This confirms that renaming historical files changes version identity and must not be done without a coordinated history plan. The original project filenames remain unchanged.

## Migration execution and catalog inspection

The three original SQL files applied in order on the disposable local Supabase database. No SQL error or dependency failure occurred. A post-apply catalog inspection found:

| Object check | Result |
|---|---:|
| Public base tables | 10 |
| Public tables with RLS enabled | 10 of 10 |
| Public RLS policies | 10 |
| Public indexes | 22 |
| Public functions | 21 |
| Non-internal triggers in `public` and `auth` | 3 |
| Migration history versions | 3, in expected order |

The three triggers include `auth_user_profile_created` on `auth.users`, the enquiry-created event trigger, and the enquiry timestamp trigger. The checked security-definer functions `create_disabled_profile` and final `admin_set_staff` had fixed `search_path=pg_catalog, public, auth, pg_temp`. Catalog grants showed `admin_set_staff` and `submit_public_enquiry` executable by `service_role` and `postgres`, not by `anon` or `authenticated`.

The SHA-256 hashes of the three original migration files matched their temporary copies after execution. No original migration file was modified or renamed.

## `auth.users` trigger verification

The inspected function inserts a profile with `STAFF` role and `DISABLED` account state, normalizes nullable metadata to empty strings, and uses `ON CONFLICT (id) DO NOTHING`. Its trigger runs after insertion on `auth.users`.

A transaction created one synthetic `.invalid` Auth user in the local database. The trigger created exactly one profile with `STAFF` / `DISABLED` defaults. A conflict-safe duplicate insert was ignored and left one profile. A second unguarded duplicate Auth insert raised the expected unique violation and left the existing profile intact. The transaction was rolled back, leaving no synthetic user or profile.

This verifies behavior against the local Supabase Auth schema. Staging still requires explicit review because migration 1 replaces a trigger on a Supabase-managed table.

## pgTAP and RLS results

The original test ran all 21 assertions and reported **20 passed, 1 failed**. Assertion 11 expected one activity row for staff A. The test inserts two enquiries, which fire the `enquiry_created_events` trigger, and then manually inserts two more activities. Staff A is correctly allowed to read both the trigger-generated row for their assigned enquiry and their own actor row, so the actual count is two. The activity from staff B on staff B's assignment was not visible.

Updated `supabase/tests/001_rls_security_test.sql` to expect two and clarified the assertion description. This changes only the test expectation; no migration changed. The corrected suite then passed **21/21** assertions against the disposable local database. All fixture inserts and role/RLS assertions are inside the test's transaction, which ends in `ROLLBACK`.

The suite provides useful but incomplete coverage; it is not a full security certification and does not exercise every mutation, retention, notification, or outbox code path.

## Errors, risks, and unresolved items

- The first attempted migration list before startup failed with `ECONNREFUSED 127.0.0.1:54322`, as expected because the local DB was not running.
- The first local stack startup with Kong excluded failed its local REST readiness probe after applying the migrations. Restarting with required services enabled succeeded.
- An attempt to run only a named test path through a workdir containing a space was not parsed correctly by the pgTAP container. Running the suite by its configured test directory, and then via a no-space temporary workdir, succeeded.
- The local startup summary printed generated local development key values. They were not saved to project files/reports and were not remote credentials. The disposable containers and volumes were removed after testing.
- The owner-supplied staging baseline has not been independently verified here. Before any staging apply, verify the intended staging project identity and inspect all relevant schema objects—not only public tables—and review the managed Auth trigger and `pgcrypto` extension effects.
- Keep the current original filenames. Use 14-digit UTC timestamp prefixes for new migration files unless the project adopts another verified convention.

## Cleanup status

The temporary Supabase stack was stopped by its specific local project ID with `--no-backup`; its project containers and data volumes are gone. The unrelated existing Docker container was left running and untouched. Deleting the two temporary working directories was blocked by the execution policy (`Remove-Item` rejected), even after verifying that both resolved paths were beneath the Windows temp directory. A filename-only inventory showed copied config/migrations/tests and CLI metadata; no `.env` was copied. These directories remain and should be removed manually when convenient:

- `C:\Users\LEGION\AppData\Local\Temp\VisionTech-P0-02B-Disposable-20261113`
- `C:\Users\LEGION\AppData\Local\Temp\VT_P002B_corrected`

No production or staging database was contacted or modified.

## Recommendation

**READY FOR STAGING MIGRATION REVIEW.** Filename compatibility, local migration order, Auth trigger behavior, and the corrected pgTAP suite were verified on a disposable local stack. This is a review-readiness conclusion only. It does not authorize applying migrations to staging or production.
