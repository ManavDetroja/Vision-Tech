# Enquiry authorization regression results

**Staging follow-up:** All four lock-order cases passed again on the deployed functions. Both former-assignee writes were denied and fixture cleanup was independently verified. [Staging verification](NOTIFICATION_STAGING_VERIFICATION_REPORT.md)

**Local result: PASS.** Tests used a newly initialized Docker Supabase project, `vt-p10a-local`, the six deployed migrations, and then both pending migrations in release order. The local target was `127.0.0.1:54322`. Before applying either candidate, the two function body fingerprints, ownership, ACLs, definer flags and search paths matched the live staging catalog. Testing used generated local identities and disposable enquiries.

## Concurrent transactions

The regression uses separate PostgreSQL sessions for the manager and staff member. An observer checked `pg_blocking_pids` for the specific waiting and holding backend PIDs before allowing the transaction to commit. A timeout fails the test if the expected overlap never occurs. The test checks the installed corrected function bodies before creating fixtures. [Repeatable local test](../services/tests/enquiry-concurrency-local.py)

| Scenario | Observed result |
| --- | --- |
| Reassignment first, status write waiting | After reassignment committed, STAFF received SQLSTATE P0001 and only the Forbidden error. Status stayed NEW. No status activity, outcome notification or result row appeared. |
| Reassignment first, follow-up write waiting | After reassignment committed, STAFF received the same error without a result row. The due time remained null, and polling created no reminder. |
| Assigned STAFF follow-up first, reassignment waiting | The authorized follow-up committed. Reassignment then committed. The poller created one reminder for the current assignee. |
| Assigned STAFF status first, reassignment waiting | The authorized close committed. Reassignment then committed. The three outcome inbox entries had delivery jobs for the assignee at the time of closing, ADMIN and SUPER_ADMIN. |
| Staff member never assigned to the enquiry | Both functions denied the request. The enquiry snapshot, activity count, inbox count and linked job count were identical before and after. |
| Former assignee after reassignment had already committed | Both repeated writes were denied. The observed denial contained no enquiry row or customer fields. |
| ADMIN and SUPER_ADMIN | Each successfully invoked both operations on another assignee's enquiry. |
| Audit and email consistency | Exactly one authorized STAFF status event and one follow-up event carried that staff member's ID in the controlled test. The denied attempts produced neither type of business event. |

## API and notification regressions

| Suite | Actual result |
| --- | --- |
| Authenticated HTTP | Both PATCH routes returned 403 to the former assignee. The response fields were exactly accepted=false, code=FORBIDDEN, a generic error message and requestId. |
| Node tests | 40 passed, 0 failed or skipped across auth, queries, enquiries, staff and notification mail. |
| Database suites | 21/21 RLS security, 18/18 enquiry API security, 12/12 staff permissions and 9/9 notification delivery. Each suite rolled back. |
| Local staff integration | 44 checks passed, including role boundaries, disabling an account and the local Auth invitation flow. |
| Enquiry API and Edge regression | All 25 lifecycle status pairs passed. Search beyond row 250, sorting/filtering, pagination, assignment/reassignment, note privacy, clearing follow-ups, timestamps/history and desktop/tablet/mobile enquiry views passed. |
| Notification integration and Edge | New enquiries, assignments/reassignments, terminal status changes, reminders, account changes, recipient isolation, mark-one/all, CSRF, pagination and browser retry passed. Edge tested 1440, 768 and 375 CSS pixels. |
| Email queue and restart | Missing configuration, simulated provider 503, stable retry payload and key, concurrent claiming, accepted-job replay and automatic pickup after API restart passed. The email provider was simulated. |
| Effective queue privileges | Anon and authenticated lacked queue SELECT and EXECUTE on claim and reminder RPCs. Service role had all three. |

Two test-harness expectations needed correction. The first SQL harness run observed the expected denial SQLSTATE but read Docker's separately multiplexed error stream out of order. Combining the streams inside the local container made the generic error and absence of a result row independently assertable. The first additional HTTP assertion expected two fields and found the API's existing four-field error envelope. The corrected assertion verified all four field names and the generic error content. The migration was unchanged throughout both reruns.

## Cleanup and limits

An independent connection found zero rows in auth.users, auth.sessions, profiles, enquiries, enquiry_notes, admin_activity, admin_notifications, email_outbox, notification_delivery and submission_rate_limits after cleanup. The two single-hit rate-limit buckets originated from the local public-form runs in this initially empty project. The disposable stack was then stopped and discarded. Independent Docker inventory showed zero containers and zero volumes with its project label.

To repeat the lock tests, initialize an empty local Supabase Docker project with the ID `vt-p10a-local`, apply the reviewed migration sequence locally, and run `python services/tests/enquiry-concurrency-local.py` with assertions enabled. The runner uses the local Docker socket or named pipe and an in-container PostgreSQL connection. Hosted behavior after deployment and mailbox delivery were outside this local run. The only hosted evidence came from the read-only catalog checks and the CLI dry run. [Staging preflight](NOTIFICATION_MIGRATION_PREFLIGHT_REPORT.md)
