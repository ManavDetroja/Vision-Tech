# Supabase Staging Migration Guide

**Prepared:** 2026-11-12  
**Current status:** Pending staging project and CLI setup. No remote migration was applied.

## Local environment findings

- `supabase` CLI: not installed/available in this execution environment.
- `psql`: not installed/available.
- `supabase/config.toml`: absent, so this project is not currently initialized as a Supabase CLI workspace.
- Docker executable: present, but no local Supabase stack or database test was run.
- Supabase environment variables and root `.env*` configuration: absent. No secret values were read.
- No staging credentials or approved target were provided; no connection or deploy attempt was made.

## Migrations to review

Apply in order only after inspecting the target migration history:

1. `202611120001_secure_admin.sql`
2. `202611120002_enquiry_lifecycle.sql`
3. `20261112170000_security_hardening.sql`

The first two prefixes are 12 digits, while the new migration follows the common 14-digit timestamp convention. Existing files may already be registered remotely under their current names. Do not rename them or mark them applied by assumption. Check the target database's migration ledger and the Supabase CLI's current migration parsing rules first.

## Safe setup sequence

1. Create a dedicated Supabase **staging** project under the business-controlled organization. Do not use production for initial validation.
2. Install the current Supabase CLI using its official instructions. Review `supabase --version` and ensure the migration filenames are recognized. Initialize local configuration only after deciding how the workspace should be tracked; do not commit access tokens or local secret files.
3. Review the target's migration history and schema. If it is a fresh project, apply all three files in order. If any migration is already recorded, reconcile filenames and SQL with that history rather than replaying blindly.
4. Prefer a disposable local database (`supabase start`, `supabase db reset`) for the first schema/test pass. These commands are destructive to that local database; use only a disposable local instance.
5. Run the pgTAP tests in `supabase/tests/001_rls_security_test.sql` with `supabase test db`. The tests use synthetic `.invalid` email addresses and roll back their fixtures. Do not run against production.
6. For staging, link only the approved staging project and review `supabase db push --dry-run` output if supported by the installed CLI. Then apply only after confirming the project reference is staging. The SQL can alternatively be applied in the Supabase SQL editor after manually checking ledger state and transaction behavior.
7. Re-run the RLS tests and manually verify anonymous, STAFF, ADMIN, and SUPER_ADMIN behavior using separate staging users. Record actual command output and project migration history without copying secrets.

Official Supabase documentation describes version-controlled [local migrations](https://supabase.com/docs/guides/local-development/database-migrations), pgTAP RLS validation through [database tests](https://supabase.com/docs/guides/database/postgres/testing-row-level-security), and the [CLI reference](https://supabase.com/docs/reference/cli/introduction). Confirm command flags with the installed CLI version before use.

## Configuration values required later

Provide these only to the API host's secret manager or private local environment (never frontend JS or committed files):

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_ORIGIN` (exact trusted web origin)
- `SESSION_ENCRYPTION_KEY` (64 hex characters for this API's AES-256 key)
- `RATE_LIMIT_HASH_SECRET` (at least 32 characters)
- Email delivery settings if enabled: `RESEND_API_KEY`, `ENQUIRY_FROM_EMAIL`, `ENQUIRY_NOTIFICATION_EMAIL`, and `ADMIN_DASHBOARD_URL`

These values are not needed to apply SQL from a private Supabase dashboard. Do not send them in chat or place them in website files.

## Staging acceptance checklist

- All migration files are recognized and apply cleanly in order.
- `supabase test db` executes all 21 prepared pgTAP assertions successfully.
- Anonymous users see only published products/services and cannot read profiles, enquiries, notes, activity, notifications, or email outbox.
- STAFF sees only assigned enquiries and associated notes/activity, plus notifications addressed to that account.
- ADMIN can manage ordinary staff and business records, but cannot grant ADMIN or change SUPER_ADMIN profiles.
- SUPER_ADMIN can grant ADMIN through the trusted staff RPC.
- User role or account state changes made directly by untrusted clients are rejected.
- Public enquiry writes only occur through the validated server path and do not confer read access.

## Production gate

This guide authorizes preparation only. Production application requires a later explicit deployment decision, a reviewed migration ledger, successful staging tests, and an independently verified backup/rollback plan. No production connection or migration was attempted here.
