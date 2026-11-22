# Notification system test report

**Staging follow-up:** The deployed database passed recipient isolation, read controls, deduplication, role restrictions and service queue checks. Email delivery remains untested. [Staging verification](NOTIFICATION_STAGING_VERIFICATION_REPORT.md)

## Result

Local notification, enquiry and staff regression checks passed. The test environment used the disposable Docker Supabase project `vt-dashboard-prompt8`, its loopback API, synthetic identities, and Microsoft Edge. The Resend endpoint was simulated. No business email was sent or received during these tests.

## Notification scenarios

| Scenario | Actual result |
| --- | --- |
| New enquiry without customer email | The public endpoint returned 201 after storage. Replaying its idempotency key returned 200. Active ADMIN and SUPER_ADMIN each received one new-enquiry alert. STAFF received none. |
| Unconfigured provider | The enquiry persisted. The worker recorded a pending retry and reflected the failed attempt to the legacy email outbox. |
| Provider outage, retries and concurrency | A simulated HTTP 503 kept the job pending. Concurrent retries produced one further provider call with the same message and idempotency key. Simulated acceptance persisted. Repeating the accepted job produced no further send. |
| New-enquiry recipients | The generated BCC list matched the two approved active managers. The generated text and HTML included the limited enquiry content and private link. |
| Assignment and reassignment | A repeated assignment produced one notification. The new assignee received the reassignment notification and the former assignee's inbox lost its enquiry link. |
| Status changes | Repeating CONVERTED and CLOSED produced one notification per actual transition per eligible manager or assignee. |
| Due follow-up | Two passes over the same overdue active assignment produced one inbox reminder. The database test confirmed zero reminder email jobs. |
| Staff changes | The normal staff-management API deactivated the assignee. The permitted manager could see the staff notification, the owner received a simulated administrative email, and subsequent dispatch excluded the disabled assignee. |
| Private access and CSRF | Anonymous inbox access returned 401. Disabled staff lost access. Another account's mark-one request returned 404. A cross-origin mark-all returned 403. Repeating an owned mark-one succeeded. Mark-all left the other manager's unread count unchanged. |
| History and responsive layout | Edge tested 1440, 768 and 375 CSS pixels. There was no horizontal document overflow. A second page was reachable. Keyboard mark-all updated the count, an injected HTTP 503 displayed the retry UI, and keyboard retry restored the list. No uncaught page exception was observed. Empty inbox results were verified through the API. |
| Worker restart | A standalone API process saved an enquiry and was restarted. The repeated submission returned 200. The restarted worker picked up the existing job and recorded a scheduled retry with provider configuration absent. |
| Template and stale attempt | The repeatable Node tests verified HTML escaping, readable plain text, omission of optional fields, and review of an expired ambiguous attempt without a provider call. |

## Regression results

| Suite | Result |
| --- | --- |
| Node auth, enquiry API, enquiry query, staff and notification mail suites | 40 passed, 0 failed, 0 skipped |
| Existing local staff integration | 44 checks passed, including RBAC, deactivation, local Auth invitation and cleanup |
| Existing enquiry integration and Edge regression | Passed all 25 status pairs, role-scoped search beyond row 250, filters, date boundaries, sorting, pagination, assignment changes, notes, follow-up and desktop/tablet/mobile detail flows |
| Existing pgTAP security, enquiry and staff suites | 21/21, 18/18 and 12/12 respectively |
| New rollback-only notification pgTAP suite | 9/9 passed |
| Effective database privileges | Anon and authenticated roles lacked queue SELECT and execution of both the claim and reminder functions. The service role held all three privileges. |

The notification integration initially used inconsistent case in synthetic email expectations. The rerun used normalized fixtures. The new SQL test initially supplied NULL for an optional customer email. The database represents the missing value as an empty string. After correcting the fixture the full suite passed. Both corrections were confined to the tests.

## Repeating the repository suites

Run the Node suites from the project root with `node --test services/tests/*.test.mjs` on a shell that expands that pattern, or pass the individual filenames. For database tests, use an isolated local Supabase instance with the candidate migration and run the four SQL files in `supabase/tests/` in order. Each suite opens a transaction and rolls it back. The staff integration runner requires an explicit local CLI executable and work directory and checks both API and database hostnames before use.

## Cleanup and limits

Tagged fixture cleanup removed the temporary integration records. The enquiry regression cleanup matched 262 synthetic enquiries and four synthetic accounts. The staff suite also verified removal of its own accounts. An independent SQL count returned zero in each of auth.users, profiles, enquiries, enquiry_notes, admin_activity, admin_notifications, email_outbox and notification_delivery. The added pgTAP test ran inside a rolled-back transaction.

The local invitation mailbox check exercised Supabase Auth's existing invite flow. Resend business email acceptance was simulated. Mailbox delivery, provider callbacks, deliverability on real networks, and the hosted staging environment were outside the test run. The browser checks used Edge only. The exact SQL, recipient decisions and staging prerequisites are in the [implementation report](NOTIFICATION_SYSTEM_IMPLEMENTATION_REPORT.md) and [provider guide](EMAIL_PROVIDER_CONFIGURATION_GUIDE.md).
