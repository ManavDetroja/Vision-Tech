# Enquiry management · Prompt 9

The dashboard's **Manage enquiries** action opens `admin/enquiries.html`. Selecting an enquiry number opens its dedicated detail page. Both pages use the existing session, private API, role checks and white-and-blue admin shell.

## Worklist and detail views

The worklist shows enquiry number, customer, phone, optional email, enquiry type, product model, status, assigned account, follow-up and submission time. Search runs across all visible rows before pagination. Users can search by number, name, phone or email, choose a status or type, set an inclusive UTC date range, and sort by submission time (both directions), customer name or enquiry number. Managers can also filter by current assignee, including disabled accounts, or find unassigned enquiries.

Pages contain 10, 25 or 50 records. Each query requests one extra row to determine whether a next page exists. Sorting includes an ID tie-breaker. Applying or clearing filters returns to page one. The list provides loading, empty, failure and retry states and ignores obsolete search responses.

Details distinguish the original customer message from staff-only notes. The product link uses the stored model and the existing catalogue route. The timeline renders status, assignment, follow-up and note events with actor and time. Notes and history each have independent 25-entry pagination. Details show the profile name when permitted by RLS and fall back to the stored identifier. The existing follow-up, notification retry and Super Admin deletion controls remain available. Status, assignment, email retry and permanent deletion use confirmation dialogs.

## Authorization and lifecycle

| Actor | Enquiry access | Operations |
| --- | --- | --- |
| STAFF | Currently assigned enquiries | Read details and private notes, change status, add notes, set or clear follow-up |
| ADMIN | All enquiries | Staff operations plus assign/reassign/unassign and existing notification retry |
| SUPER_ADMIN | All enquiries | Administrator operations plus existing confirmed deletion |
| Anonymous or disabled | Private routes require an authorized active session | Access denied |

The deployed status RPC accepts NEW, CONTACTED, IN_PROGRESS, CONVERTED and CLOSED from every existing status. Reopening and same-status requests are permitted. The UI and API use that lifecycle. The RPC updates the enquiry and inserts its status event in one transaction. Existing RPCs likewise audit assignments, notes and follow-ups. Assignment requires a manager and an active target profile of an existing permitted account, or an explicit null to unassign. Omitted and malformed assignees are rejected.

The private API verifies Supabase identity and current profile, derives permissions server-side, checks Origin for writes, and forwards the signed-in user's token to PostgREST. Notes are available through the private detail endpoint. Search, sort, dates, pagination, UUIDs, status, assignment and note type/length are validated. The query builder uses fixed identifiers, validated values and encoded PostgREST parameters. Mutations use structured JSON parameters to the existing database functions. Browser content derived from records is escaped.

## API and files

| Existing endpoint | Use |
| --- | --- |
| GET /api/admin/enquiries | Filters `q`, `status`, `type`, `from`, `to`, `assignedTo`, `sort`, `page`, `pageSize`. Returns rows, current page, page size and hasMore. |
| GET /api/admin/assignees | Manager-only directory. Active accounts by default. Optional includeDisabled=true for the historical assignment filter. |
| GET /api/admin/enquiries/{id} | Visible enquiry, private notes, activity and manager-only email metadata. Optional notesPage and historyPage. |
| PATCH /api/admin/enquiries/{id}/status, /assign, /follow-up | Update the corresponding field using the existing audited RPC. |
| POST /api/admin/enquiries/{id}/notes | Add a private text note. |
| DELETE /api/admin/enquiries/{id} | Existing confirmed SUPER_ADMIN deletion. |

Changed existing files: `js/admin/app.js`, `css/admin.css`, `services/admin-api.mjs` and `services/api/supabase.mjs`. New files: `js/admin/enquiries.js`, `services/api/enquiry-query.mjs`, `services/tests/enquiry-query.test.mjs` and the two Prompt 9 reports.

## Limits

The timeline can show only information recorded by the existing schema. Assignment and status events store the new value and actor. Historical display names and previous-value snapshots are unavailable. An unavailable catalogue model follows the catalogue's existing not-found behavior. List pagination uses offsets, so concurrent inserts or edits can move rows between pages. The check of active assignee or current staff assignment and the subsequent update are separate statements inside the existing RPCs. Simultaneous deactivation/reassignment and edits were not concurrency-tested. Database changes would need separate review. Search is capped at 120 characters and accepts letters, marks, digits and common name/contact punctuation.

Verification and outstanding test coverage are recorded in the [test report](ENQUIRY_MANAGEMENT_TEST_REPORT.md).
