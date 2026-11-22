# Prompt 8 · Admin dashboard verification

**The final local HTTP and browser integration run passed.** The real native Node API used Supabase Auth, PostgREST and PostgreSQL on loopback in the disposable `vt-dashboard-prompt8` project. All six existing migrations ran there. Four temporary accounts and six enquiries provided known database records. Browser tests rendered responses from that API. The production dashboard contains no fixture data.

## Counts and permissions

| Database scope | Total | New | Pending | In progress | Resolved | Raw status counts (new, contacted, in progress, converted, closed) |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| ADMIN and SUPER_ADMIN | 6 | 2 | 3 | 1 | 1 | 2, 1, 1, 1, 1 |
| STAFF, assigned enquiries | 3 | 1 | 2 | 0 | 0 | 1, 1, 0, 1, 0 |
| Empty enquiry tables, all roles | 0 | 0 | 0 | 0 | 0 | 0, 0, 0, 0, 0 |

For each populated role, the runner read the local database's enquiry IDs, statuses, timestamps and assignees independently of the overview endpoint. The returned status counts, recent IDs and outstanding follow-up IDs matched. Monthly counts from oldest to newest were 0/0/0/0/2/4 for administrators and 0/0/0/0/1/2 for staff. The existing database RPC supplied all six monthly buckets. The staff summary returned two STAFF accounts, one active and one disabled, to managers. The STAFF response omitted the summary data.

| Check | Observed result |
| --- | --- |
| Session and API authorization | All three active roles signed in. Anonymous overview returned 401. A disabled user could not sign in (403). A previously signed-in staff member received 403 after deactivation. |
| Enquiry activity | Both managers saw seven enquiry events, including the staff note event. The staff member saw four within assignment scope. |
| Staff activity | Managers saw the event performed by the staff member. An administrator's staff-management event was excluded from this actor-based list. |
| Audit fields | Overview's general activity entries excluded raw audit details and actor IDs. |
| Notifications | Each manager saw six initial unread enquiry notifications. Staff saw zero. With 101 more unread notifications for ADMIN, the notifications endpoint returned 100 list entries and an exact unread count of 107. |
| Upstream failures | A failed stats RPC produced HTTP 502 and no partial statistics. An unreachable upstream auth service produced HTTP 503. |
| Dashboard empty and retry | The empty ADMIN view displayed zero enquiry counts and a trend empty state. Injecting a 503 on the overview request displayed the alert. Activating Try again with Enter restored the dashboard. |
| Quick actions | STAFF had one link, ADMIN three, SUPER_ADMIN four. The browser followed each populated role's links and verified the destination rendered its admin heading without the section-error state. |
| Responsive and console checks | Headless Microsoft Edge tested 1440×960, 768×1024 and 375×812. The empty ADMIN view and all three populated role views fit without document-level horizontal overflow. The browser checked visible metric values, link counts, console errors, page exceptions and failed network responses. Normal paths passed. The deliberately injected 503 was tested separately. |
| Existing regression suites | `node --test services/tests/auth.test.mjs services/tests/enquiry-api.test.mjs services/tests/staff.test.mjs` passed 36/36, exit 0. |

## Execution notes

The interrupted run left four local users and six enquiries. A scoped cleanup removed those disposable records before the full rerun. When verification resumed, Docker Desktop's Linux engine pipe was unavailable. Starting Docker Desktop restored the local stack. The initial sandbox run of the regression suite also hit loopback `EACCES`. All three suites passed with local network access.

After the final run, independent SQL counts for users, profiles, enquiries, activity, notifications and email-outbox entries were all zero. The disposable stack then stopped successfully.

The integration harness and final output are in the disposable workspace at `C:\Users\LEGION\Documents\Codex\2026-11-13\p0-02b-disposable-local-supabase-migration` (`dash8-integration.mjs`, `dash8-browser.py`, `dash8-final-run.txt`). Replaying the harness requires its isolated local project and an empty fixture database. It performs local Auth sign-ins and temporary database writes.

Verification covered the local integrated dashboard and existing regression suites. Hosted staging, production deployment, Safari/Firefox, assistive-technology user testing and production-scale load testing were outside this run.
