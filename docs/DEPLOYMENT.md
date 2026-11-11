# Backend deployment

The public pages can be previewed through VS Code Live Server. Live Server does not run the private API or persist customer enquiries. Live enquiry and admin functionality require a deployed Node runtime, Supabase project and (for email) Resend account/configuration.

## Server environment

Configure these values in a server-side secret manager, never in browser JavaScript:

```text
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_ANON_KEY=<public anon key, server configuration>
SUPABASE_SERVICE_ROLE_KEY=<secret service role key>
APP_ORIGIN=https://<public-site-origin>
SESSION_ENCRYPTION_KEY=<64 hexadecimal characters>
RATE_LIMIT_HASH_SECRET=<at least 32 random characters>
ADMIN_API_PORT=4175
NODE_ENV=production
TRUST_PROXY=true
RESEND_API_KEY=<optional until email is configured>
ENQUIRY_FROM_EMAIL=<verified sender when email is enabled>
ADMIN_DASHBOARD_URL=https://<public-site-origin>/admin/dashboard.html
```

Use a Node version that supports native ES modules, `fetch`, and modern crypto APIs. Start with `node services/admin-api.mjs`. The process binds to loopback port 4175 by default. Configure the HTTPS reverse proxy so `/api/` forwards to that process, passes the original allowed site origin, and overwrites forwarding headers. Serve static files from the same origin when possible. For a separate origin, configure exact `APP_ORIGIN` and credentialed CORS; do not use wildcards.

`GET /api/health` reports whether required backend configuration is present. It does not prove database connectivity. Do not expose detailed health output publicly if that reveals deployment metadata.

## Database and bootstrap

1. Create a dedicated Supabase project and apply the SQL migration.
2. Configure Auth URL allowlists, invite redirect, MFA and password policy.
3. Create the first Auth user and use the migration's final bootstrap statement to activate it as SUPER_ADMIN.
4. Run `node services/seed-admin-data.mjs` to upsert the existing 22 product records and service content.
5. Configure a verified email sender and the secret values above; keep notification provider credentials server-side.
6. Deploy the Node API behind HTTPS, then configure `PUBLIC_API_BASE_URL` in `js/data/contact-config.js` and `ADMIN_API_BASE_URL` in `js/data/admin-config.js` to the API origin (empty string for same-origin proxy).
7. Test only with authorized synthetic data in a non-production environment first.

Do not run the seed script before confirming the project URL and that it is the intended environment. Do not run this API under VS Code Live Server.
