# Enquiry management · verification results

The final integrated run passed on a disposable loopback Supabase stack using the six existing migrations, real Supabase Auth sessions, the native Node HTTP API and Microsoft Edge. Four temporary accounts and 262 disposable enquiries exercised the normal private routes. No staging or production data was used.

| Area | Actual result |
| --- | --- |
| Role and session gates | SUPER_ADMIN, ADMIN and STAFF logged in. Disabled login returned 403. Anonymous list/detail returned 401. STAFF saw its single assignment, received 404 for an unrelated detail and 403 for an unrelated note and assignment attempts. ADMIN deletion returned 403. |
| Search | Name with an apostrophe, phone, enquiry number and email with a literal underscore each found the expected oldest record beyond the former 250-row cutoff. |
| Filters and sorting | Combined status, installation type, unassigned and a one-day UTC range returned the record at 23:59:59.999. The assignee filter returned the expected single record. Default newest, oldest, customer and number ordering were exercised. Ten-row page two began at P9-010. Fifty-row page six included the final customer in customer order. |
| Input validation | Rejected invalid page, page size, date, date range, status, type, assignee and wildcard search with 422. Malformed follow-up date, object-valued note, omitted assignee, and nonexistent lifecycle status returned 422. Wrong mutation Origin returned 403. |
| Details and private notes | Product model and original record loaded. Staff note persisted with authenticated author ID and timestamp. Staff saw no private email-outbox metadata. |
| Lifecycle and history | Exercised all 25 ordered combinations of the five stored statuses. Responses matched every destination. Reading successive history pages found all 25 staff-authored transitions with matching actor, valid destination and timestamp. |
| Assignment | ADMIN reassigned an enquiry away from STAFF. Its previous assignee immediately received 404 on detail. SUPER_ADMIN cleared and reassigned it to STAFF. The timeline contained all three assignments in sequence. Disabled target returned 422. |
| Follow-up | Assigned STAFF set a date, verified it on the detail response, then cleared it successfully. |
| Browser views | ADMIN opened the real list and details at widths 1440, 768 and 375 pixels. Both views fit without document-level horizontal overflow. Pagination, empty search, Clear, cancelled/confirmed status change, timeline refresh and private note creation passed. |
| Failure and retry | An injected list HTTP 503 produced the accessible error state. Pressing Enter on Retry restored the real list. Normal browser paths had no uncaught page exceptions or failed HTTP responses. |
| Regression tests | Existing auth, public enquiry API and staff suites passed 36/36. The new query suite passed 2/2, covering UTC leap-day boundaries, stable ordering, lookahead pagination and rejection before a database request. |

The first browser run caught a Clear-filter timing issue. The reset handler could read the previous values before the browser finished resetting them. The final implementation explicitly resets the form before applying its values. First-run fixtures were cleaned up and the complete integration workflow then exited 0.

## Cleanup and evidence

After the final run, fixture-scoped cleanup removed four temporary Auth users, 262 enquiries, 324 activity records and 526 notifications. Foreign keys removed dependent profiles, notes and outbox entries. An independent SQL count returned **0** in each of auth.users, profiles, enquiries, enquiry_notes, admin_activity, admin_notifications and email_outbox. The named local stack then stopped successfully.

The disposable workspace at `C:\Users\LEGION\Documents\Codex\2026-11-13\p0-02b-disposable-local-supabase-migration` contains `p9-test.mjs`, `p9-browser.py`, the final run log `p9-final.txt`, and the fixture cleanup SQL `p9-clean.sql`. Repository query tests run with `node --test services/tests/enquiry-query.test.mjs`.

## Outstanding coverage

Role-specific API behavior was tested for all three roles. Interactive browser workflows were tested with ADMIN in Edge. Hosted verification, other browsers, assistive-technology user testing, concurrent writes, production-scale query performance and actual email delivery remain unverified. Verification exercised the denial of ADMIN deletion. It did not perform a successful permanent deletion through the UI.
