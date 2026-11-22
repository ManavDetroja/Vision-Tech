# Prompt 8 · Admin dashboard

The dashboard opens at `admin/dashboard.html` after a successful staff login. The existing HTML entry point loads the shared admin shell and the new dashboard renderer. Counts and lists come from the private API on each page load.

## What the numbers mean

| Display | Definition |
| --- | --- |
| Total enquiries | All enquiries the signed-in user can see. STAFF see assigned enquiries. ADMIN and SUPER_ADMIN see the business total. |
| New | Current status is NEW. |
| Pending | NEW plus CONTACTED. The card includes new enquiries, so adding all overview cards together would double-count them. |
| In progress | Current status is IN_PROGRESS. |
| Resolved | Current status is CLOSED. The lifecycle migration renamed RESOLVED to CLOSED. Conversions remain separate. |
| Status distribution | Each enquiry falls into exactly one of the five stored statuses. |
| Monthly submissions | Counts by creation month for the database's last six calendar months, including the current month to date. The chart labels month and year. |
| Staff overview | Total, active and disabled accounts with the STAFF role. Administrator accounts are outside this count. |

## Role-specific behavior

| Role | Data and actions |
| --- | --- |
| STAFF | Assigned enquiries, due follow-ups, permitted activity and own notifications. Quick action opens Manage enquiries. |
| ADMIN | Business enquiry figures, staff overview, recent activity by staff, product count and own notifications. Quick actions open enquiries, staff and products. |
| SUPER_ADMIN | Same overview scope as ADMIN, plus a quick action for private admin settings. |

Recent lists show up to eight items each. Staff activity uses the event actor's current STAFF role, so a staff member's work on an enquiry can appear there. The separate administrative feed includes other authorized events. The overview requests action, entity type and time for audit entries, plus the staff actor's display name for the manager-only staff feed. It omits audit details and customer messages. Dates for individual events use the viewer's local time.

## Integration and changed files

| File | Change |
| --- | --- |
| `js/admin/dashboard.js` | Renders the overview, status and monthly charts, staff summary, recent lists, due follow-ups, notifications and quick actions using shared formatting and escaping. |
| `js/admin/app.js` | Connects the renderer to the existing session, navigation, loading and retry flow. Staff opening Manage enquiries skip the manager-only assignee request. |
| `css/admin.css` | Adds responsive dashboard metrics, charts and panels using the existing brand styles. |
| `services/admin-api.mjs` | Extends the two existing authenticated GET endpoints below. |
| `services/api/supabase.mjs` | Supports exact PostgREST HEAD counts and raises an upstream error if the count header is missing or invalid. |
| `docs/ADMIN_DASHBOARD_IMPLEMENTATION_REPORT.md`, `docs/ADMIN_DASHBOARD_TEST_REPORT.md` | Implementation definitions, validation results and scope. |

**GET /api/admin/overview** reuses the deployed `admin_dashboard_stats` RPC for the enquiry totals and monthly series. Recent records, due follow-ups, unread notifications and the additional activity reads use the signed-in user's access token. The server checks the verified profile role before issuing either staff count or the staff activity query. STAFF receive a null staff overview. The response includes a server timestamp for the displayed update time.

**GET /api/admin/notifications** returns the existing list and an exact RLS-scoped unread count for the header bell, including unread records beyond the 100-item list. The shell also uses the existing session and logout endpoints. Server-side session validation, active-profile checks, role checks, origin protection for writes, and database policies continue to govern the underlying admin pages. Overview responses use the shared no-store response helper.

The dependency-free charts display numeric values alongside the bars. The page uses the existing sidebar, skip link and retry button. A failed upstream request reaches the error state instead of producing an apparent zero count. Related dashboard sections use separate database requests, so changes made concurrently can become visible in different sections until the next reload.

See [dashboard test results](ADMIN_DASHBOARD_TEST_REPORT.md) for the tested roles, counts, screen sizes and remaining verification limits.
