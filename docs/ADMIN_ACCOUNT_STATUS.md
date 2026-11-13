# VisionTech Admin Account Status

Checked: 2026-11-12

## Findings

| Check | Result | Evidence |
|---|---|---|
| Supabase Auth configured | **No, not in this environment** | The local API `/api/health` returned HTTP 503 and listed missing `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_ORIGIN`, `SESSION_ENCRYPTION_KEY`, and `RATE_LIMIT_HASH_SECRET`. None of those variable names were present in the process environment. No root `.env*` file was found. No secret values were read or included in this report. |
| Administrator account exists | **Cannot verify; no configured Supabase connection is available** | The project contains a migration and a bootstrap SQL comment, but neither is evidence of an actual Auth user. There is no configured database to query. |
| Administrator email | **Not available / not verified** | No live Auth user or admin profile could be queried. No email address is inferred or exposed. |
| Initial password configured securely | **Cannot verify** | Supabase Auth is not connected here, and no password was retrieved. Passwords should be created/reset through Supabase Auth rather than stored in project files or frontend code. |
| Administrator login succeeds | **Not testable; blocked by missing configuration** | The local API returned HTTP 503 for `/api/auth/session` with `Admin API is not configured.` No login attempt against a real Supabase Auth project was possible. |
| Unauthorized dashboard access blocked | **Data API is designed to enforce authorization; live protection is unverified** | Admin pages call `/api/auth/session` before loading private data; the API revalidates Supabase Auth sessions and active profiles, checks roles, and the migration defines RLS for protected tables. However, static HTML shells are publicly fetchable on a static host. Private records depend on the deployed API and applied database policies; these protections have not been verified against a configured project. |

## Secure bootstrap steps

No account was created or changed during this check.

1. Create or select the dedicated Supabase project and apply the reviewed migration `supabase/migrations/202611120001_secure_admin.sql` (and any later migration required by the deployed application).
2. In Supabase Authentication, invite the administrator using an approved business-controlled email address. Use Supabase’s invite/reset flow so the administrator sets their own password through the emailed link. Do not place a password in source code, a checked-in `.env` file, or this report.
3. The migration creates a profile for new Auth users in the `DISABLED` state with the default `STAFF` role. In the private Supabase SQL editor, verify the invited user’s UUID and then promote only that exact account to the bootstrap role:

   ```sql
   update public.profiles
   set role = 'SUPER_ADMIN', account_state = 'ACTIVE'
   where id = '<verified AUTH_USER_UUID>';
   ```

4. Configure the API’s secrets only in the server/hosting secret manager. Set the exact allowed `APP_ORIGIN`, deploy the API behind the site’s `/api` route (or configure its public base URL), and use HTTPS in production.
5. Verify `/api/health` reports ready, sign in using the administrator’s own password, and test logout, disabled-account rejection, and unauthenticated API denial. Confirm the RLS policies are applied and that anonymous requests cannot read enquiry, notes, activity, notification, or email-outbox records.
6. After the first administrator works, issue additional individual staff invitations and verify least-privilege role behavior. Do not share the bootstrap administrator password.

## Current limitation

The project’s admin authentication implementation exists, but the administrator account state is **unknown**. The local Supabase configuration and live database are unavailable, so account existence, email, password setup, successful login, and live RLS behavior cannot be confirmed. The public admin HTML is a static shell and should not be treated as server-side route protection by itself.
