# Notification migration preflight

**Subsequent outcome:** The owner approved this plan. Both versions are now recorded on staging. The six-entry ledger below is the pre-deployment snapshot. [Deployment and final ledger](NOTIFICATION_STAGING_DEPLOYMENT_REPORT.md)

**Prompt 10A decision: READY FOR STAGING APPROVAL for the two migrations in the order below.** The original review withheld approval because the deployed status and follow-up functions could authorize writes based on a stale assignment. The new correction passed controlled, overlapping transactions in both commit orders on a disposable local database. Staging still runs the six predecessor migrations.

## Target, ledger and migration integrity

The local project-ref file and linked-project metadata agree with the remote CLI on **VisionTech-Staging**, reference `fszrsispjxunckknphaw`. The CLI's `production` label identifies the default branch of that staging project. Every remote command used the explicit reference. Supabase CLI 3.1.0 supplied both `db query --read-only` and `db push --dry-run --skip-vault`.

| Local migration in deployment order | Remote ledger | Relevant dependency |
| --- | --- | --- |
| `202611120001_secure_admin.sql` | 202611120001 | Original profiles, enquiries, inbox, email outbox, new-enquiry trigger, assignment RPC, recipient policies and table grants |
| `202611120002_enquiry_lifecycle.sql` | 202611120002 | CONVERTED/CLOSED, follow-up timestamp and index, status and follow-up RPCs |
| `20261112170000_security_hardening.sql` | 20261112170000 | Definer search paths, protected staff updates and enquiry update timestamp trigger |
| `20261116130000_enquiry_sequence_privileges.sql` | 20261116130000 | Restricted direct sequence access. Number allocation remains inside the existing intake function. |
| `20261116130100_optional_enquiry_email.sql` | 20261116130100 | Service-only idempotent public submission, including customers without an email address |
| `20261122000100_staff_activity_access.sql` | 20261122000100 | Restrictive active-account SELECT policy on admin_activity |
| `20261122000150_atomic_enquiry_updates.sql` | **Absent before and after preview** | Fixes status and follow-up authorization first |
| `20261122000200_notification_delivery.sql` | **Absent before and after preview** | Adds the notification queue and triggers second |

All six predecessor file hashes matched the recorded Prompt 7 review. The new correction has SHA-256 `6C513B389554C6A8E298F8B772195DB6E9B618D23AFD3F1E5BFCDC1A0296F820`. The unchanged notification candidate is 8,055 bytes. SHA-256 is `966FE7EE1CA61FCAF498443004AAFDBF1B64610796784F1BEA12FE317CF1998D`, matching the implementation report. [Candidate SQL](../supabase/migrations/20261122000200_notification_delivery.sql) · [Earlier hash inventory](STAFF_ACTIVITY_RLS_MIGRATION_REVIEW.md)

The live catalog had no candidate queue table, new inbox columns, named indexes, new functions, or new triggers on the four existing source tables. The staging snapshot had zero enquiries, zero inbox rows and zero historical outbox rows qualifying for backfill. Existing RLS was enabled on profiles, enquiries, admin_notifications and email_outbox.

```powershell
supabase db push --dry-run --skip-vault --remote=fszrsispjxunckknphaw --workdir 'C:\Vision Tech'
```

The installed CLI executable returned exit 0. Its result was:

```json
{"upToDate":false,"dryRun":true,"migrations":["20261122000150_atomic_enquiry_updates.sql","20261122000200_notification_delivery.sql"],"seeds":[],"roles":[],"message":"Finished supabase db push.","target":{"kind":"linked","project_ref":"fszrsispjxunckknphaw","project_name":"VisionTech-Staging","environment":"production"}}
```

The post-preview read-only query returned six ledger entries, zero applied candidates and a null queue relation. A separate disposable local run actually applied both files in this exact order and executed the regression suites.

## Corrective migration

The first migration replaces only `public.admin_update_enquiry_status(uuid,text)` and `public.admin_set_enquiry_follow_up(uuid,timestamptz)`. It checks the current assignment in each UPDATE and locks the active actor profile during the operation. Both retain their postgres owner, ACLs, SECURITY DEFINER flag, hardened search path and return type. The live source fingerprints matched the initial local baseline. [Exact SQL](../supabase/migrations/20261122000150_atomic_enquiry_updates.sql) · [Function and grant comparison](ENQUIRY_AUTHORIZATION_RACE_FIX_REPORT.md)

## Notification migration object inventory

All objects below are in the public schema.

| Object | Change |
| --- | --- |
| admin_notifications | Adds nullable `staff_id uuid` referencing profiles(id) ON DELETE SET NULL, and nullable `reminder_for timestamptz`. Existing rows require no values. |
| notification_delivery | New RLS-enabled table. Columns: `id uuid` UUID-generated PK, `notification_id uuid`, `outbox_id uuid`, `state text` default PENDING, `attempts integer` default 0, `next_attempt timestamptz` default now(), `lease uuid`, `first_send timestamptz`, `fingerprint text`, `provider_id text`, `last_error text`. The PK, state, attempts and next_attempt are required. |
| Queue constraints and implicit indexes | PK index on id. Unique constraints and backing indexes on notification_id and outbox_id. Each references its source table's id ON DELETE CASCADE. Exactly one source must be non-null. State is limited to PENDING, ACCEPTED, SKIPPED or REVIEW. |
| Explicit indexes | `notifications_history_idx` on admin_notifications(recipient_id, created_at DESC, id DESC). `notification_delivery_due_idx` on notification_delivery(next_attempt,id) for PENDING rows. Unique `notification_followup_once` on admin_notifications(recipient_id,enquiry_id,reminder_for) for non-null reminder times. |
| enqueue_notification_delivery() | New trigger function. Creates a job for a new outbox row or eligible operational inbox event. Unique source keys suppress repeat insertion. |
| admin_assign_enquiry(uuid,uuid) | Replaces existing function body. Manager check and return type preserved. Checks and locks active assignee, locks enquiry, skips identical assignment, audits real changes, notifies the new assignee. |
| notify_operational_change() | New trigger function. Routes actual terminal status changes and staff role/state changes to eligible active profiles. |
| claim_notification_delivery(uuid DEFAULT NULL) | New service RPC. Claims one due PENDING job, increments attempt count, installs a lease and sets its expiry. |
| reflect_notification_delivery() | New trigger function. On completion of an outbox-backed attempt, updates the legacy outbox fields status, provider_message_id, attempts, last_error, updated_at and sent_at. |
| enqueue_due_followups() | New service RPC. Generates at most 100 due reminders per call for open enquiries with active assignees. The unique reminder index handles overlapping polls. |
| Triggers on existing tables | `queue_new_enquiry` AFTER INSERT on email_outbox. `queue_operational_notification` AFTER INSERT on admin_notifications. `notify_enquiry_outcome` AFTER UPDATE OF status on enquiries when status changes to CONVERTED or CLOSED. `notify_staff_access` AFTER UPDATE OF role or account_state on profiles when either value changes. |
| Trigger on new table | `reflect_new_enquiry_delivery` AFTER UPDATE on notification_delivery when an outbox-backed row releases its lease. |
| Policies, grants and backfill | Zero policies created, replaced or removed. Queue RLS has no client policies. Revokes queue privileges from PUBLIC, anon and authenticated, grants service_role SELECT/INSERT/UPDATE/DELETE. Revokes client EXECUTE on all five new functions, grants service_role EXECUTE on claim and reminder RPCs. Existing assignment EXECUTE ACL survives replacement. Backfills each old non-SENT outbox row to REVIEW, with no automatic resend. |

The migration adds schema without removing business data, but changes runtime behavior. An identical assignment now produces no audit event, timestamp change or email. A reassignment uses a distinct kind. A legacy failed outbox entry may now require provider reconciliation. The candidate is a one-time migration and cannot be replayed unconditionally. The new API history join requires the new staff foreign key. During a rollout, quiesce the legacy synchronous sender and its retry route, allow in-flight sends to settle, apply the separately approved schema, confirm PostgREST recognizes the new relationship, then activate the matching API and worker. Overlapping the old and new senders can duplicate a real email.

## Recipient isolation and service permissions

| Principal | Effective behavior |
| --- | --- |
| Anonymous | No private inbox or worker API. Authenticated session required by the backend. Active-account and role lookup helpers can be called but return only information about the caller. |
| Active STAFF | Own inbox/history and read receipts. Enquiry links require current assignment. Receives assignments, important outcomes for assigned work and due follow-ups. No staff directory or email retry permission. |
| Active ADMIN | Own inbox only. New enquiry and outcome events, active assignments and staff events for STAFF targets. May retry new-enquiry outbox delivery and read manager-visible legacy outbox results. |
| Active SUPER_ADMIN | Own inbox only. May see permitted management links for all staff roles and retry new-enquiry delivery. A higher application role does not open another recipient's inbox. |
| Disabled account | Even with a previously issued user token, inbox SELECT and UPDATE require active membership and matching recipient. The mark-one definer RPC independently checks both. The legacy outbox policy requires a current active manager role. The new queue is inaccessible to client roles. The private API checks Auth, then reloads the profile. |
| Service role | Trusted server worker can claim, update, and schedule across users. Staging has BYPASSRLS for this role. Recipient eligibility for outbound email therefore depends on server-side rechecks. Staff email must match the approved profile/address pair. The separately approved business mailbox receives the new-enquiry preview independently of staff membership. |

The live inbox SELECT and UPDATE predicates include both `recipient_id = auth.uid()` and `is_active_account()`; UPDATE also checks the resulting row. Live authenticated grants allowed updating read_at and denied updating recipient_id or inserting a notification. The user-token API scopes one/all read actions and validates IDs, with the central same-origin check for writes. GET history/count uses user RLS. The manager-only retry uses the server worker and returns acceptance status. Queue privileges in the candidate were verified again on the corrected local stack. They cannot be live-tested until the table exists. [Notification test report](NOTIFICATION_SYSTEM_TEST_REPORT.md)

History belongs to its recipient. A historical notification can survive reassignment. The history endpoint joins through current record access and omits an inaccessible link. The overview endpoint still selects the stored enquiry UUID, and a directly authorized inbox reader can see identifiers on their own historical row. These identifiers do not grant access to customer details. The pre-existing profiles SELECT policy also allows active managers to read profiles more broadly than the ADMIN directory endpoint. Neither is a cross-recipient inbox grant.

All six functions in the candidate are SECURITY DEFINER. Five new functions use `pg_catalog, public, pg_temp`; the replacement assignment function uses `pg_catalog, public, auth, pg_temp`. Application references are schema-qualified. Staging anon and authenticated lack CREATE in public and auth. Assignment is owned by postgres. Its authenticated EXECUTE grant is intentional and its body checks for an active manager. The trigger functions execute through their attached triggers. Claim and reminder execution remain server operations. The migration changes no Auth table, Auth trigger or hosted setting.

## Queue and failure behavior

* Enquiry intake returns the stored enquiry after the database transaction. Its public API path does not call Resend. The existing idempotency key protects the enquiry, and a unique queue reference protects each outbox or operational event. A database trigger or permission error can still roll back the underlying write. An unavailable email provider cannot do so.
* Workers claim with row locking and SKIP LOCKED, use a two-minute lease, and condition progress/final updates on the job ID and lease token. Idle workers poll every 15 seconds and drain at most 20 jobs per tick. The original event and delivery job commit together. Current recipient eligibility and record access are checked before forming the outgoing message. A final access change after that check cannot recall an email already handed to the provider.
* The provider request uses an eight-second timeout, a per-job idempotency key and a persisted envelope fingerprint. Ambiguous requests reuse the key and message. A changed envelope, HTTP 409, or an attempt at least 23 hours after the first send enters REVIEW. Resend documents a 24-hour key retention window. ACCEPTED records a provider ID, not a mailbox receipt. [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys)
* There is **no numeric maximum attempt count**. Delays cap at one hour. Missing configuration before first_send can leave a job pending indefinitely. A manager can retry an unleased outbox job before its scheduled time. REVIEW, SKIPPED and ACCEPTED are excluded from claims. Monitor backlog age and REVIEW outcomes, and reconcile provider records before any manual resend.
* A failing reminder RPC aborts the rest of that worker tick and delays mail until a successful tick. Cascading deletion of an enquiry's outbox or an inbox entry can remove the corresponding job, including delivery metadata. The queue is an operational log with the lifetime of its source. Legacy outbox SENT means provider acceptance, while FAILED can be a retryable attempt.
* The normal indexes and table alterations take database locks. The inspected staging workload had empty enquiry and inbox tables. Recheck volume and the ledger immediately before any separately authorized deployment.

## Retest and deployment conditions

The two-session regression observed actual PostgreSQL lock waits for status and follow-up writes. When reassignment committed first, each waiting STAFF write received Forbidden, returned no row and generated no business activity or customer notification. In the opposite commit order, each authorized write completed before reassignment. Independent HTTP checks on both endpoints returned the standard 403 envelope without customer data. Both manager roles retained their permitted operations. [Test results](ENQUIRY_AUTHORIZATION_RACE_TEST_REPORT.md)

The rerun passed 40 Node tests, 60 pgTAP assertions, 44 staff integration checks, all 25 enquiry lifecycle status pairs, the notification/browser scenarios and the standalone worker restart check. No real email was sent. All synthetic data was removed and the disposable local stack was discarded.

The approval request is for the ordered pair at the hashes above. If the hashes, ledger or preview differ before deployment, reconcile them first. Coordinate the old-to-new sender cutover and verify permissions after the approved deployment. Owner-approved sender and recipients and a controlled mailbox test are still required to enable and verify live business email. Deployment has not been authorized or performed in this review.

**READY FOR STAGING APPROVAL**
