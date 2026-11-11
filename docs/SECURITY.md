# Security and customer data

## Trust boundaries

The public site is static. `services/admin-api.mjs` is the private Node API that must run on the server or behind an HTTPS reverse proxy. It stores access and refresh tokens in an AES-256-GCM encrypted, HttpOnly, SameSite=Strict cookie. It checks the authenticated user and active profile on every private request. Origin is checked for mutations. Public forms use server-side validation, a honeypot, idempotency keys and a database rate limiter.

`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `SESSION_ENCRYPTION_KEY`, `RATE_LIMIT_HASH_SECRET` and all provider configuration belong only in the server environment/secret store. Never put them in `js/`, HTML, public configuration, source control, or a browser bundle. The service role bypasses RLS and is used only by the private Node service for public form writes and notification outbox tasks. Admin reads/writes use the signed-in user's access token and database policies. See [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security) and [Edge Function secret guidance](https://supabase.com/docs/guides/functions/secrets) for keeping privileged keys server-side.

The current server binds to `127.0.0.1`. Deploy behind a proxy that terminates TLS, sets the correct `APP_ORIGIN`, and strips/replaces incoming `X-Forwarded-For`. Set `TRUST_PROXY=true` only in that trusted-proxy arrangement; otherwise the API hashes the socket address. Do not directly expose the service port to the internet.

## Privacy

Customer records are not stored in localStorage or returned from public APIs. The migration does not insert synthetic records. Notifications may include only enquiry IDs/titles in the admin UI. Email notifications contain the specified short preview and link; restrict the configured recipients to active admins. Establish a retention and deletion policy before production operation.

The enquiry delete action requires a confirmation dialog and SUPER_ADMIN authorization, and records an audit event. Configure backups and deletion retention to match local requirements before activation. Never use real customer data for test submissions without authorization.

## Operational protections

- Set a long random 32-byte hex `SESSION_ENCRYPTION_KEY`; keep it stable across API instances or sessions will be invalidated.
- Set a separate high-entropy `RATE_LIMIT_HASH_SECRET` of at least 32 characters.
- Configure HTTPS, a narrow allowed origin, database backups, monitoring and secret rotation.
- Configure Supabase Auth invite redirect URLs and MFA/password policy in the project.
- Keep API logs free of request bodies, customer messages, tokens and secret values.
- Rate-limit the reverse proxy as an additional layer; database limits are not a substitute for bot controls.
- Do not enable public contact publication until business details are verified and approved.

Supabase RLS policies are part of the trust boundary and must remain enabled. Do not grant anonymous access to enquiries, profiles, notes, email outbox or activity.
