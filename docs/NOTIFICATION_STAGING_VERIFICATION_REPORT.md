# Staging authorization and notification verification

**Passed on VisionTech-Staging (`fszrsispjxunckknphaw`), 22 November 2026.** All 33 database checks and all four two-session concurrency cases passed on the deployed functions. An independent connection confirmed cleanup.

## Authorization and notification assertions

A PL/pgSQL subtransaction created four synthetic identities and an enquiry with an explicit enquiry code. The test switched to the authenticated database role and set transaction-local identity claims for STAFF, ADMIN and SUPER_ADMIN. It also exercised anonymous and service-role privileges. Each expected denial checked SQLSTATE and, where applicable, the specific business error. Failed expectations abort the test. The successful path deliberately rolled back fixture changes before returning the assertion count. A delivery job was claimed inside that subtransaction without invoking an email provider.

| # | Staging assertion | Result |
| --- | --- | --- |
| 1 | One durable new-enquiry job | PASS |
| 2 | New-enquiry inbox routed to both managers only | PASS |
| 3 | One own assignment despite duplicate request | PASS |
| 4 | Recipient may mark own notification | PASS |
| 5 | Assigned staff can set status | PASS |
| 6 | Assigned staff can set follow-up | PASS |
| 7 | STAFF cannot assign | PASS |
| 8 | STAFF cannot invoke delivery claim | PASS |
| 9 | Other staff sees no enquiry or inbox item | PASS |
| 10 | Other staff cannot mark notification | PASS |
| 11 | Never assigned staff denied status | PASS |
| 12 | Never assigned staff denied follow-up | PASS |
| 13 | Admin reassignment succeeds | PASS |
| 14 | Admin cannot see the staff recipient’s inbox row | PASS |
| 15 | Admin cannot mark staff notification | PASS |
| 16 | Former assignee denied status | PASS |
| 17 | Former assignee denied follow-up | PASS |
| 18 | Rejected writes leave fields unchanged | PASS |
| 19 | Only authorized staff actions appear in business audit | PASS |
| 20 | Rejected outcomes create no notifications | PASS |
| 21 | Admin may set status | PASS |
| 22 | Admin may change follow-up | PASS |
| 23 | Repeated polling produces one reminder for current assignee | PASS |
| 24 | Reminder produces no email job | PASS |
| 25 | Service can claim job and cannot reclaim during lease | PASS |
| 26 | Super admin can clear follow-up | PASS |
| 27 | Super admin can close enquiry | PASS |
| 28 | Outcome mailed via one queue entry per eligible recipient | PASS |
| 29 | Cannot assign disabled target | PASS |
| 30 | Disabled account cannot see old notifications or assigned enquiry | PASS |
| 31 | Disabled account denied follow-up | PASS |
| 32 | Disabled account denied status | PASS |
| 33 | Anonymous role denied inbox | PASS |

## Concurrent staging transactions

The contention run used three new synthetic identities with empty notification addresses, four explicit-ID enquiries, and two independent authenticated-role database transactions per case. The holder waited for `pg_blocking_pids` to identify it as the blocker of the specific competing session before committing. Every case required the reviewed function fingerprints. Setup and reassignment removed only fixture-generated delivery jobs within the creating transaction. No fixture email job became visible to a sender. Follow-up writes in the contention run used a future due date.

| Operation | First transaction holding the enquiry row | Verified result |
| --- | --- | --- |
| Status | Administrator reassignment | Waiting former assignee received Forbidden. Status stayed NEW, assignee changed, zero staff business writes. |
| Follow-up | Administrator reassignment | Waiting former assignee received Forbidden. Follow-up stayed null, assignee changed, zero staff business writes. |
| Status | Assigned staff update | Staff change committed first. Reassignment then committed. Final status CONTACTED and exactly one authorized staff business write. |
| Follow-up | Assigned staff update | Staff change committed first. Reassignment then committed. Future due time preserved and exactly one authorized staff business write. |

## Cleanup and scope

A fresh read-only connection found zero rows after the rollback suite. After the independent contention run, cleanup used the generated identity and enquiry IDs. A second fresh read-only query found zero rows in each of `auth.users`, `auth.sessions`, `public.profiles`, `public.enquiries`, `public.enquiry_notes`, `public.admin_activity`, `public.admin_notifications`, `public.email_outbox`, `public.submission_rate_limits` and `public.notification_delivery`. The ledger still contained all eight migration versions.

The staging checks exercised PostgreSQL RPCs, roles, policies, triggers and queue behavior. Hosted browser login, HTTP response formatting and mailbox delivery were outside this verification. No real email was sent. [Deployment and catalog evidence](NOTIFICATION_STAGING_DEPLOYMENT_REPORT.md) · [Local API and browser regression results](ENQUIRY_AUTHORIZATION_RACE_TEST_REPORT.md)
