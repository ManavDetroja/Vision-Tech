# Supabase RLS Test Results

**Run date:** 2026-11-13  
**Execution status:** **BLOCKED — tests prepared but not executed.**

## Test environment

- Supabase CLI: 3.1.0 available through `npx`.
- Docker CLI: 29.6.2; engine unavailable on the latest check.
- `psql`: missing.
- `supabase/config.toml`: initialized locally; no running local database.
- Dedicated staging project and credentials: not provided/configured.
- No remote or local database test was run. No accounts or customer records were created.

The suite at `supabase/tests/001_rls_security_test.sql` contains 21 pgTAP assertions inside a transaction ending in `ROLLBACK`. Fixtures use synthetic `.invalid` emails and fixed test UUIDs. A local stack start was attempted, but no Supabase containers appeared and Postgres was unreachable; the command was stopped. Prepared tests are not passed tests.

## Assertion-by-assertion status

| # | Prepared assertion | Result |
|---:|---|---|
| 1 | Anonymous role sees published product rows only | BLOCKED — not run |
| 2 | Anonymous role cannot read profiles | BLOCKED — not run |
| 3 | Anonymous role cannot read enquiries | BLOCKED — not run |
| 4 | Anonymous role cannot read internal notes | BLOCKED — not run |
| 5 | Anonymous role cannot read administrative activity | BLOCKED — not run |
| 6 | Anonymous role cannot read notifications | BLOCKED — not run |
| 7 | Anonymous role cannot read email outbox | BLOCKED — not run |
| 8 | Staff sees assigned enquiries only | BLOCKED — not run |
| 9 | Staff sees notes associated with assigned enquiries only | BLOCKED — not run |
| 10 | Staff sees own notifications only | BLOCKED — not run |
| 11 | Staff sees own/assigned enquiry activity only | BLOCKED — not run |
| 12 | Staff cannot update their profile role directly | BLOCKED — not run |
| 13 | Staff cannot update a product through the admin RPC | BLOCKED — not run |
| 14 | Admin can read all enquiries | BLOCKED — not run |
| 15 | Admin can read hidden and published product rows | BLOCKED — not run |
| 16 | Admin can update a product through the authorized RPC | BLOCKED — not run |
| 17 | Anonymous cannot execute staff administration RPC | BLOCKED — not run |
| 18 | Authenticated role cannot execute service-only staff administration RPC | BLOCKED — not run |
| 19 | Admin cannot promote a staff account to Admin | BLOCKED — not run |
| 20 | Failed elevation leaves staff role unchanged | BLOCKED — not run |
| 21 | Super Admin can grant Admin through the staff RPC | BLOCKED — not run |

## Requirements not covered by these 21 SQL assertions

The current suite does not verify an actual Auth public-signup setting, invalid/expired HTTP tokens, HTTP role boundaries, public form-to-database submission, or all function/grant metadata. Those require configuration/catalog/API checks once staging is available. It also should receive a dedicated assertion for cross-user notification row exclusion and security-definer function catalog properties before final security sign-off; test 10 currently checks the expected count for one synthetic user's result.

## Required run sequence

After staging is created and migration history is reconciled, run the supported command for the installed CLI (currently documented as `supabase test db`) against a disposable local database first, then staging if approved. Save the actual summary and SQLSTATE outcomes with tokens, passwords, customer details, and project secrets omitted. Add a test-specific record for any failure, make the smallest secure fix, and rerun the failed and regression cases.

**Current totals:** 0 passed, 0 failed, 21 blocked/not run. This is a test readiness report, not a security certification.
