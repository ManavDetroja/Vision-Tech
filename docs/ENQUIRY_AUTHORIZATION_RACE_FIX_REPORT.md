# Enquiry authorization correction

**Result:** The owner-approved correction is deployed to staging. Four overlapping-transaction tests passed there. The comparison below records the original pre-deployment baseline. [Deployment](NOTIFICATION_STAGING_DEPLOYMENT_REPORT.md) · [Staging verification](NOTIFICATION_STAGING_VERIFICATION_REPORT.md)

## Deployed functions and callers

| Function in public | Authenticated backend caller | Existing business effects |
| --- | --- | --- |
| `admin_update_enquiry_status(p_enquiry_id uuid, p_status text) RETURNS public.enquiries` | PATCH `/api/admin/enquiries/{id}/status`, with the session user's JWT | Updates lifecycle status and the applicable converted, closed and resolved timestamps. Inserts ENQUIRY_STATUS_CHANGED with the acting user. The pending notification trigger queues recipient alerts on actual transitions to CONVERTED or CLOSED. |
| `admin_set_enquiry_follow_up(p_enquiry_id uuid, p_follow_up_at timestamptz) RETURNS public.enquiries` | PATCH `/api/admin/enquiries/{id}/follow-up`, with the session user's JWT | Sets or clears the follow-up date and inserts ENQUIRY_FOLLOW_UP_CHANGED. The separate reminder poller uses the committed due time and current assignee of an open enquiry. |

The exact deployed bodies are the two definitions in the [enquiry lifecycle migration](../supabase/migrations/202611120002_enquiry_lifecycle.sql), with the function search paths subsequently set by the [hardening migration](../supabase/migrations/20261112170000_security_hardening.sql). Read-only staging catalog inspection matched both bodies to the disposable six-migration baseline. The following values are MD5 fingerprints of `pg_proc.prosrc` with carriage returns removed, for comparison of SQL text across platforms.

| Function | Deployed body | Corrected local body |
| --- | --- | --- |
| Status | `38b5fe4d9b1a3959557ff44e9ba577fb` | `cc22d18ab0a1f9b879da92edd922812c` |
| Follow-up | `08e2131d59c68263f5f8c4598fe7fc6c` | `1e75a87c88d251438c6ff9843d8b28d2` |

For both functions, before and after local replacement, the owner was postgres, SECURITY DEFINER was set, and the search path was `pg_catalog, public, auth, pg_temp`. Both staging ACLs and both local ACLs were `{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}`. Anonymous callers have no EXECUTE grant. Authenticated EXECUTE authorizes invocation. The function determines business access from the active profile and the target row. The API already verifies the session, profile and request origin. Enquiry SELECT RLS grants active managers broad access and limits STAFF to their assignment. The definer functions must independently enforce writes.

## What changed

The deployed functions first checked whether STAFF owned the enquiry, then updated by enquiry ID alone. Under READ COMMITTED those statements can see different assignments. Both functions return the affected enquiry on success, so stale authorization put both the mutation and returned customer details at risk.

The new migration contains exactly two CREATE OR REPLACE FUNCTION statements. Each takes a shared row lock on the authenticated actor's active profile and reads its role. The UPDATE predicate checks the enquiry ID and permits either a manager or STAFF whose UUID still matches assigned_to. A concurrent reassignment that wins the row lock causes PostgreSQL to recheck the predicate when the waiting UPDATE resumes. Zero matching rows for STAFF raises Forbidden before returning a row or recording a business action. If the staff write wins, it completes under the existing assignment before the reassignment proceeds. Account deactivation and role changes must also serialize with the shared profile lock.

The migration preserves function signatures, manager capabilities, successful return types and activity writes. Status values, timestamp handling and clearing a follow-up still use the existing contract. No grants, policies, tables, Auth configuration or application code changes were required. Permission denials may still be logged independently as security events by the API. [Complete corrective SQL](../supabase/migrations/20261122000150_atomic_enquiry_updates.sql) · [Backend callers](../services/admin-api.mjs)

## Staging approval scope

| Order | Migration | SHA-256 |
| --- | --- | --- |
| 1 | `20261122000150_atomic_enquiry_updates.sql` | `6C513B389554C6A8E298F8B772195DB6E9B618D23AFD3F1E5BFCDC1A0296F820` |
| 2 | `20261122000200_notification_delivery.sql` | `966FE7EE1CA61FCAF498443004AAFDBF1B64610796784F1BEA12FE317CF1998D` |

The corrective version sorts after all six deployed versions and before notifications. The two files applied in this order against a fresh local six-migration baseline. The staging dry run independently selected the same pair. Approval covers this ordered plan. The read-only review and preview left staging at six migrations. Business email delivery still needs owner-approved configuration and a controlled mailbox test. [Concurrency and regression results](ENQUIRY_AUTHORIZATION_RACE_TEST_REPORT.md) · [Updated preflight](NOTIFICATION_MIGRATION_PREFLIGHT_REPORT.md)
