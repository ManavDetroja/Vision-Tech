# Backend deployment

The public pages can be previewed through VS Code Live Server. Live Server does not run the private API or persist customer enquiries. Live enquiry and admin functionality require a deployed Node runtime, Supabase project and (for email) Resend account/configuration.

## Server environment

Configure these values in a server-side secret manager, never in browser JavaScript:

```text
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<staging publishable key>
SUPABASE_SECRET_KEY=<staging secret key; server only>
APP_ORIGIN=https://<public-site-origin>
RATE_LIMIT_HASH_SECRET=<at least 32 random characters>
ADMIN_API_PORT=4175
NODE_ENV=production
TRUST_PROXY=true
RESEND_API_KEY=<optional until email is configured>
ENQUIRY_FROM_EMAIL=<verified sender when email is enabled>
ADMIN_DASHBOARD_URL=https://<public-site-origin>/admin/dashboard.html
```

Use a Node version that supports native ES modules, `fetch`, and modern crypto APIs. For local Windows development, create `C:\Vision Tech\.env` from `.env.example` and start from the project root with `node --env-file=.env services/admin-api.mjs`. The API does not auto-load `.env`. The process binds to loopback port 4175 by default. Configure the HTTPS reverse proxy so `/api/` forwards to that process, passes the original allowed site origin, and overwrites forwarding headers. Serve static files from the same origin when possible. For a separate origin, configure exact `APP_ORIGIN` and credentialed CORS; do not use wildcards.

Send Supabase publishable/secret API keys in `apikey`. Send only the signed-in user's access token in `Authorization: Bearer ...`. Never use the new secret API key as a bearer token.

`GET /api/health` checks required public API configuration and a safe zero-row Supabase query. It returns only readiness booleans, uses a 10-second cache, and returns 503 on failure. See BACKEND_API_ARCHITECTURE.md for the current API contract.

## Database and bootstrap

1. Create a dedicated Supabase project and apply the SQL migration.
2. Configure Auth URL allowlists, invite redirect, MFA and password policy.
3. Obtain explicit owner approval for the first privileged identity and follow `SUPER_ADMIN_BOOTSTRAP_GUIDE.md`; never automatically promote a signup.
4. If separately approved for the verified target, `node services/seed-admin-data.mjs` upserts the current product records and service content. Inspect its input before running; do not assume historical catalogue counts.
5. Configure a verified email sender and the secret values above; keep notification provider credentials server-side.
6. Deploy the Node API behind HTTPS, then configure `PUBLIC_API_BASE_URL` in `js/data/contact-config.js` and `ADMIN_API_BASE_URL` in `js/data/admin-config.js` to the API origin (empty string for same-origin proxy).
7. Test only with authorized synthetic data in a non-production environment first.

Do not run the seed script before confirming the project URL and that it is the intended environment. Do not run this API under VS Code Live Server.

## Prompt 6 authentication hosting constraints

Use one long-lived Node process with same-origin static/API hosting behind HTTPS. Opaque sessions are held in process memory; restarting signs users out. Multiple workers/replicas or ephemeral serverless functions require a shared session store before deployment. SESSION_ENCRYPTION_KEY is no longer used. Strict cookies require same-site requests; prefer the same-origin proxy rather than cross-site hosting. Use Secure cookies in HTTPS environments and redact recovery-page query strings from access logs.

Supabase Auth recovery email is separate from Resend enquiry notifications. Configure the exact frontend origin and `/admin/reset-password.html` redirect, an approved sender and test inbox, then verify delivery and browser completion. Current staging recovery redirects/email round trip are not verified. See ADMIN_AUTHENTICATION_TEST_REPORT.md. No MFA challenge UI is implemented; do not claim MFA enforcement. Existing database deployment notes below are historical evidence, not authorization to apply new migrations.

## 2026-11-16 approval checkpoint

The original three migrations are deployed to staging. Two additional migrations for sequence least privilege and optional enquiry email were explicitly approved, deployed and verified on staging. All five versions are recorded; see BACKEND_MIGRATION_DEPLOYMENT_REPORT.md. Review ENQUIRY_SEQUENCE_PERMISSION_REVIEW.md before any further migration command. Do not blindly apply all local migrations. Contact uses same-origin /api/enquiries; configure the reverse proxy before enabling the frontend in a hosted environment.
