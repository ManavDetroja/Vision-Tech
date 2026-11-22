# Notification system implementation

Reviewed 22 November 2026. The notification database migration is deployed and verified on staging. Live email delivery remains untested. The standalone Node API runs the worker. The frontend continues to use the private HTML admin pages and Vanilla JavaScript. [Staging deployment](NOTIFICATION_STAGING_DEPLOYMENT_REPORT.md)

## Events and recipients

| Event | Dashboard recipients | Email recipients |
| --- | --- | --- |
| New customer enquiry | Active ADMIN and SUPER_ADMIN | Approved business mailbox, with eligible owner-approved managers in BCC |
| First assignment or reassignment | Current assignee | Current active assignee with an approved address |
| Converted or closed enquiry | Active managers and current active assignee, once each | Same group, restricted to approved addresses |
| Scheduled follow-up becomes due | Current active assignee of an open enquiry | Inbox only |
| Staff role or activation changes | Active SUPER_ADMIN accounts and active ADMIN accounts permitted to manage the target's current role | Same group, restricted to approved addresses |

CONVERTED and CLOSED are the selected important status changes. The lifecycle history still records intermediate changes. Repeating the same assignment or status produces no extra notification. Removing an assignment leaves its audit record. The former assignee receives no reassignment email. Internal notes and customer-directed mail are outside these event templates.

## Inbox and access

The bell shows the signed-in account's unread count and refreshes every minute. Its link opens timestamped history with 25 entries per page, mark-one and mark-all actions, keyboard controls, progress, empty and retry states. Every role reads its own history through the session and existing recipient RLS. Links require current access to the enquiry or staff record. Disabling an account revokes private inbox access.

| Endpoint | Use |
| --- | --- |
| GET /api/admin/notifications?view=count | Unread count |
| GET /api/admin/notifications?page=1 | Paginated history in descending creation order, with ID as tiebreaker |
| POST /api/admin/notifications/{id}/read | Mark an owned notification read |
| POST /api/admin/notifications/read-all | Mark the signed-in account's unread rows read |
| POST /api/admin/email-outbox/{id}/retry | Existing manager-only retry for a new-enquiry delivery |

The server obtains the account and role from the existing session. Writes use the existing origin checks. The service key stays in the backend. Read and update grants on the new delivery queue exclude browser roles.

## Persistence and delivery

The same database transaction that records an event creates its inbox entry and delivery job. The public form returns after the enquiry is persisted. Sending happens in a separate worker. Assignment changes lock the enquiry and check the proposed assignee. Follow-up reminders are unique per assignee, enquiry and scheduled time.

Workers claim due jobs with a two-minute lease and row locks. Before provider submission the worker rechecks current permissions and approved addresses, saves a hash of the outgoing message, and uses the job ID as the provider idempotency key. Retry delays increase from one minute to one hour. Ambiguous attempts older than 23 hours, conflicting provider keys and changed messages enter REVIEW. Existing unsent historical outbox rows also enter REVIEW for reconciliation. Accepted jobs carry the provider message ID. The old new-enquiry outbox mirrors the result for existing consumers.

## Files in this milestone

| Files | Change |
| --- | --- |
| `supabase/migrations/20261122000200_notification_delivery.sql` | New queue, triggers, indexes, claim and reminder functions, assignment idempotency |
| `services/api/notification-mail.mjs` | Server-side worker, recipient checks, branded HTML and plain text, retry handling |
| `services/admin-api.mjs` | Inbox endpoints, retry handling and standalone worker startup |
| `services/api/public-routes.mjs` | Return the saved enquiry independently of provider availability |
| `services/api/config.mjs`, `.env.example` | Server-only recipient configuration and placeholders |
| `services/api/supabase.mjs` | Safe error mapping for unavailable notification rows |
| `js/admin/app.js`, `js/admin/notifications.js`, `js/admin/staff.js` | Bell, inbox, read actions and staff detail navigation |
| `services/tests/notification-mail.test.mjs`, `supabase/tests/004_notification_delivery_test.sql` | Repeatable email behavior and transactional database tests |
| `docs/NOTIFICATION_SYSTEM_IMPLEMENTATION_REPORT.md`, `docs/NOTIFICATION_SYSTEM_TEST_REPORT.md`, `docs/EMAIL_PROVIDER_CONFIGURATION_GUIDE.md` | Migration review, evidence and operational handoff |

## Migration for review

The complete proposed SQL is in the [migration file](../supabase/migrations/20261122000200_notification_delivery.sql). SHA-256 on disk is `966FE7EE1CA61FCAF498443004AAFDBF1B64610796784F1BEA12FE317CF1998D`. It adds objects after the existing six migrations and replaces the body of `admin_assign_enquiry(uuid,uuid)` while keeping its existing calling contract and grants. The new trigger functions have fixed search paths and restricted execution. Review the historical outbox handling before enabling workers on a populated database.

## Operational status

The event matrix, queue retries, real local database permissions, browser UI and worker restart were exercised locally. Live email, real recipients and hosted execution are pending. The worker needs a running API process. Local verification used one disposable environment and a simulated email provider. The provider guide covers configuration, acceptance versus delivery, and review of older jobs. [Test report](NOTIFICATION_SYSTEM_TEST_REPORT.md) · [Email configuration guide](EMAIL_PROVIDER_CONFIGURATION_GUIDE.md)
