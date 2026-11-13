# Supabase RLS and Database Security Review

**Reviewed:** 2026-11-12  
**Result:** SQL review completed locally; live security status remains **BLOCKED / UNVERIFIED** until staging exists and tests execute.

## Evidence and limits

Inspected migrations `202611120001_secure_admin.sql` and `202611120002_enquiry_lifecycle.sql`, the API in `services/admin-api.mjs`, admin staff UI in `js/admin/app.js`, and Supabase setup state. The CLI and `psql` are unavailable, `supabase/config.toml` and environment credentials are absent, and API health is documented as HTTP 503. No database was reachable or queried. No live RLS claim is made.

## Policy review

| Data | Anonymous | Authenticated Staff | Admin / Super Admin | Write path |
|---|---|---|---|---|
| Profiles | No table access | Own profile | Admins read profiles | Provisioning/staff RPC; direct client writes revoked |
| Enquiries | No table access | Assigned records | All | Server-only public submission RPC; admin workflow RPCs |
| Notes | No table access | Assigned enquiry notes | All | Authorized note RPC |
| Notifications | No table access | Own recipient rows | Own recipient rows | Own read status only; creation from database trigger |
| Email outbox | No table access | No table access | Read | Service-only delivery status RPC |
| Admin activity | No table access | Own and assigned enquiry activity | All | Trusted workflow functions/triggers |
| Rate limits | No table access | No table access | No table access | Server-only public submission function |
| Products/services | Published only | Published plus admin visibility | All | Admin RPCs |
| Site settings | Restricted public RPC only | No table read by default | Super Admin | Super Admin RPC |

The intended guards use `profiles.account_state = ACTIVE` and the role attached to the authenticated Supabase user. RLS is enabled in the initial migration; table grants are separately restricted. Sensitive writes should go through security-definer RPCs with explicit authorization.

## Findings and prepared remediation

### P0: administrator role escalation in staff management

The pre-hardening `admin_set_staff` function allowed either `ADMIN` or `SUPER_ADMIN` as the actor and permitted `ADMIN` to request the `ADMIN` role. The staff API also accepted role `ADMIN` from an Admin actor. This violated the requirement that only a Super Admin grant elevated administrator roles.

**Prepared fix:** migration `20261112170000_security_hardening.sql` restricts database staff management so an ADMIN can only manage STAFF and assign STAFF; only a SUPER_ADMIN can grant ADMIN; neither can modify a SUPER_ADMIN through this RPC. The API rejects ADMIN invitations/role changes by ADMIN actors, and the staff UI only offers roles each actor may request. The database check is authoritative; UI/API checks are defense in depth.

### P1: unsafe security-definer search paths

Existing security-definer functions used `public` and sometimes `auth` without `pg_catalog` first or `pg_temp` last. Migration 003 updates the search path of existing functions and its new trigger/RPC. This is a prepared SQL change, not yet verified in Postgres.

### P1: enquiry update timestamp missing

Existing lifecycle functions update enquiry status/follow-up without an `updated_at` column. Migration 003 adds the column and a before-update trigger so all update paths maintain it.

### P1: migration tooling compatibility

The two existing migration names use 12-digit prefixes; the additive migration uses 14 digits. CLI parser/history behavior has not been tested. Preserve the old names until staging history is inspected, then resolve any compatibility issue without renaming a migration already applied remotely.

### Operational boundary

Admin HTML is static. It is not server-side route protection on its own. The private API still validates sessions and role/profile state; staging/hosting should protect API data and decide whether to protect the static admin shell as well.

## Test readiness

`supabase/tests/001_rls_security_test.sql` contains 21 pgTAP assertions for anonymous reads, published product visibility, assigned staff access, profile write denial, admin product access, product update permissions, notification ownership, staff RPC grants, and role escalation. It uses synthetic fixture IDs and `.invalid` email names inside a rollback transaction.

| Check | Result |
|---|---|
| Migration source inspection | Complete locally |
| RLS test file prepared | Complete locally (21 assertions) |
| SQL parser / migration application | Blocked: no Supabase CLI or `psql` |
| pgTAP execution | Blocked: no local Supabase database/configuration |
| Live anonymous/authenticated policy verification | Blocked: no staging project credentials |
| Browser/API integration verification against Supabase | Blocked: API unconfigured |

Do not interpret the prepared test count as passed tests. The success criteria are pending until the actual test runner returns a clean result on staging.

## Remaining risks

- Existing first/second migration contents still require a staging apply and catalog inspection. SQL text review alone does not prove actual RLS grants/policies.
- Public enquiry validation, idempotency and rate limiting need real database/API end-to-end tests with synthetic data.
- Email outbox delivery and dashboard notification behavior require server configuration and provider tests.
- Auth invite, password recovery, disabled-account rejection, secure cookies, CSRF/origin behavior, backups, and restore remain outside live verification.
- `service_role` bypasses RLS; protect it in the server secret manager and restrict access to the API process.

## Required next evidence

Set up a dedicated staging project, reconcile migration history, apply the reviewed SQL, run `supabase test db`, and manually probe table/RPC access with anonymous, STAFF, ADMIN, and SUPER_ADMIN sessions. Preserve command output and results with secret values redacted. Only then update this report from pending to verified.
