# VisionTech business notification email

The backend reuses Resend for business notifications. Supabase Auth invitations and password resets have their own configuration. The sender, business mailbox and individual recipient addresses require owner approval. Real mailbox delivery remains unverified.

## Server configuration

Supply settings to the standalone API through the deployment secret store. For local development the existing command from the project root is `node --env-file=.env services/admin-api.mjs`. The local environment file is `C:\Vision Tech\.env`. Keep live values outside source control, frontend JavaScript and browser configuration.

| Variable | Required value |
| --- | --- |
| RESEND_API_KEY | Server-side Resend sending credential scoped to the approved sender domain where available |
| ENQUIRY_FROM_EMAIL | Owner-approved sender on a verified domain |
| ENQUIRY_NOTIFICATION_EMAIL | Approved private business mailbox for new customer enquiries |
| APP_ORIGIN | Canonical frontend origin used by the existing API |
| ADMIN_DASHBOARD_URL | Absolute dashboard URL on APP_ORIGIN, for example the approved origin followed by /admin/dashboard.html. Use HTTPS for hosted environments. |
| NOTIFICATION_APPROVED_RECIPIENTS | JSON object mapping each approved profile UUID to its approved email address. Default is an empty object. |

Use a JSON object of the form `{"<profile UUID>":"<owner-approved mailbox>"}`. Each entry must match the profile's current notification email. Approve the business mailbox independently because it can receive a customer name and message preview. A manager's eligibility alone does not subscribe their mailbox. Removing an entry prevents future sends to that profile. When creating a new assignment, configure its approved address first if the assignee must receive the email. Ineligible queued jobs can end in SKIPPED.

## Owner setup and rollout

1. Approve the sending domain and sender, the new-enquiry business mailbox, and the individual mailboxes allowed to receive assignment, status or administrative notices.
2. In Resend, verify the sending domain using its dashboard instructions and provision the backend credential. Store it only on the server. [Resend domains](https://resend.com/docs/dashboard/domains/introduction)
3. Review the exact migration and authorize staging separately. Coordinate the schema and backend rollout so the previous synchronous sender and the new worker do not process the same enquiries. Configure the approved staging recipients before starting the new API. [Proposed migration](../supabase/migrations/20261122000200_notification_delivery.sql)
4. Keep the standalone API process running. It polls every 15 seconds and resumes queued work after a restart. Start it with the same environment used by the authenticated admin API. Confirm the API is reachable from the private dashboard.
5. Once an owner-controlled test mailbox and a targeted send are authorized, submit one test enquiry, record its enquiry ID and provider message ID, inspect the Resend event, and confirm receipt of both the expected subject and private dashboard link. Verify a separate assignment reaches only the approved assignee. Use approved disposable records and clean them up afterward.

## Delivery checks and recovery

Use aggregate SQL in an authorized database session to monitor the queue without retrieving customer messages or mailbox addresses.

```sql
select state, count(*) as jobs, min(next_attempt) filter (where state='PENDING') as earliest_retry
from public.notification_delivery
group by state order by state;
```

| State | Meaning and action |
| --- | --- |
| PENDING | A worker can claim the job when due. Check API uptime, provider and configuration if errors recur. |
| ACCEPTED | Resend returned success and a message ID. Use that ID to verify downstream delivery in Resend and confirm receipt with the controlled mailbox. |
| SKIPPED | No eligible recipient or record remained before the first send. Review current permissions and approval if an operational email was expected. |
| REVIEW | A prior send may have succeeded, an attempted envelope changed, the provider returned a conflict, or the row predates the new worker. Reconcile with provider history before deciding whether a separate send is justified. |

Resend documents a 24-hour idempotency window. VisionTech stops automatic retries 23 hours after the first send attempt. The existing outbox label SENT corresponds to provider acceptance. There is no delivered/bounced webhook in this milestone. Dashboard access does not depend on delivery. [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys) · [Send email API](https://resend.com/docs/api-reference/emails/send-email)

The local root environment check inspected the presence of the five notification-specific settings without printing values. None was assigned in that file at inspection time. Hosted environment variables and provider account status were not inspected.
