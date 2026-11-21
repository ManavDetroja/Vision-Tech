# Backend API architecture

Reviewed and implemented 2026-11-16. Target for integration tests: VisionTech-Staging (`fszrsispjxunckknphaw`). No production deployment.

## Existing stack and decision

The repository has no package.json, lockfile, Express dependency or frontend build pipeline. Its existing API is services/admin-api.mjs, a Node HTTP server using native ES modules, fetch and crypto. Retain that stack; no dependency installation is needed. Tested with Node 24.14.1. Existing private authentication, staff, product, service, notification and enquiry-management routes remain; this milestone did not create accounts or implement a replacement admin system.

## Boundaries

| File | Responsibility |
| --- | --- |
| services/admin-api.mjs | Server entry, CORS, existing private route dispatch and email delivery |
| services/api/config.mjs | Environment configuration and public/admin readiness requirements |
| services/api/constants.mjs | Existing roles, statuses and enquiry types |
| services/api/http.mjs | Bounded JSON reader, consistent response envelope, safe errors/logging |
| services/api/supabase.mjs | Supabase headers, timeouts and safe upstream error mapping |
| services/api/auth.mjs | Trusted Supabase identity/refresh and active-role authorization boundary |
| services/api/auth-routes.mjs | Login/logout and recovery controllers with Origin and abuse checks |
| services/api/session-store.mjs | Opaque revocable server sessions; single-process memory store |
| services/api/validation.mjs | Typed enquiry validation and normalization |
| services/api/rate-limit.mjs | HMAC client identity and bounded in-process abuse limiter |
| services/api/enquiry-service.mjs | Existing atomic enquiry RPC and acknowledgement verification |
| services/api/public-routes.mjs | Public enquiry controller/route and cached connectivity health |

Public request flow: Contact form -> JSON POST with stable Idempotency-Key -> exact origin check -> configuration check -> local abuse limiter -> bounded JSON parse -> validation -> service-key RPC -> database transaction (enquiry/activity/notifications/outbox) -> notification attempt -> acknowledged response. No success before database confirmation. Email failure does not discard the saved enquiry.

The service calls the existing submit_public_enquiry(p_payload jsonb, p_idempotency_key uuid, p_rate_hash text). It does not invent tables or bypass the RPC transaction. Existing enquiry columns and RPC validation were inspected. RLS and existing role checks remain. The service-only RPC runs as its postgres owner and needs no caller sequence privilege.

## Environment and startup

Exact local file: `C:\Vision Tech\.env`, unchanged, ignored and untracked. Load it explicitly from the project root:

```powershell
node --env-file=.env services/admin-api.mjs
```

The API does not automatically read .env. Server-side variables: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY (legacy SUPABASE_ANON_KEY fallback), SUPABASE_SECRET_KEY (legacy SUPABASE_SERVICE_ROLE_KEY fallback), APP_ORIGIN and RATE_LIMIT_HASH_SECRET. As of Prompt 6, SESSION_ENCRYPTION_KEY is obsolete: cookies contain opaque IDs and tokens remain server-side. Optional enquiry-email variables remain RESEND_API_KEY, ENQUIRY_FROM_EMAIL, ENQUIRY_NOTIFICATION_EMAIL and ADMIN_DASHBOARD_URL. Auth recovery mail is configured separately in Supabase. ADMIN_API_PORT defaults to 4175. NODE_ENV=production enables secure cookies. Never put secrets into browser config.

APP_ORIGIN must be an exact origin (no path, wildcard, embedded credentials or trailing slash); hosted origins/URLs must use HTTPS, with HTTP accepted only on loopback. The API binds to 127.0.0.1. Put it behind a trusted HTTPS reverse proxy. TRUST_PROXY must remain false unless the proxy overwrites X-Forwarded-For; enabling it behind an untrusted/direct connection allows spoofed rate identity. Run one long-lived Node process; opaque sessions are not shared between workers and restart signs users out. See ADMIN_AUTHENTICATION_ARCHITECTURE.md for session/recovery details and limitations.

New keys are sent in apikey. User sessions use publishable apikey plus the user's JWT in Authorization. Service requests use secret apikey without substituting it for a user bearer. Legacy JWT API keys retain their legacy transport fallback for anonymous/service requests. The client rejects mixing a service request with a user token. Reference: [Supabase API key documentation](https://supabase.com/docs/guides/getting-started/api-keys).

## Public contracts

| Route | Behavior |
| --- | --- |
| GET /api/health | 200 when configured and safe SELECT can reach enquiry schema; otherwise 503. Returns only ready/configured/databaseReachable booleans. Database result cached 10 seconds and concurrent checks coalesced. No customer rows fetched. |
| POST /api/enquiries | JSON and exact Origin required; UUID Idempotency-Key required. Returns 201 on new acknowledged save, 200 on acknowledged duplicate. |
| Existing /api/public/* | Published product/service/contact read routes preserved. |
| Existing /api/auth/* and /api/admin/* | Existing authorization preserved; not expanded or publicly exposed. |

Successful enquiry response: accepted=true, enquiryId (public enquiry code), savedAt. Failure response: accepted=false, code, error; validation may include fields; centralized exceptions include a requestId. HTTP statuses: 400 malformed JSON/key, 401 unauthenticated, 403 forbidden origin/role, 413 excessive body, 415 unsupported media/encoding, 422 invalid fields, 429 rate limit, 502 upstream/database response failure, 503 unavailable configuration/network, 500 unexpected failure. Private older handlers continue using their existing safe messages, wrapped in the shared envelope.

Logs include only a generated request ID, fixed event/code and HTTP status. They do not include request paths/query strings, payloads, headers, exception messages, SQL or stack traces. Supabase requests have an eight-second timeout; no redirect following. Request/header timeouts are bounded. JSON is limited to 32 KiB for enquiries, including streamed bodies; smaller existing private endpoint limits remain.

## Validation and abuse controls

Only plain-object JSON is accepted. Text fields must be strings, NFC-normalized and trimmed; emails are lowercased and phone punctuation removed. Name 2â€“100; optional email <=254 with syntax check if supplied; phone 7â€“15 digits, optional leading plus, input <=20 characters with balanced parentheses; message 20â€“2000; model <=100 and constrained syntax; service requirement <=180 and required for service categories. Consent must be boolean true; nonempty honeypot is rejected. Markup delimiters and unsafe control characters are rejected. SQL-like text is bound as JSON data, never concatenated into SQL. Existing later displays escape data.

The in-memory limiter allows 20 attempts/minute/address, includes invalid submissions, caps tracked buckets at 10,000 and expires them. It is per process; the existing database limiter persists five new submissions per 15-minute bucket across processes/restarts. Idempotent retries do not create a second enquiry/outbox. Do not use this as a replacement for trusted-proxy/network-level abuse controls.

## Frontend

Contact form uses same-origin /api/enquiries. No credential is shipped to the browser. Use an HTTPS reverse proxy to run frontend and API at the same origin, or explicitly configure a public API URL plus exact CORS origin. Live Server alone does not implement /api and therefore cannot save; failure preserves entries and never reports success. Email is optional in the form, and acknowledgement must contain accepted=true, a nonempty enquiry ID and a valid timestamp. Availability copy does not claim a backend connection merely because a URL is configured. Product enquiry demonstration modal remains unchanged; the Contact form is this milestone's integrated flow.

**Deployed 2026-11-16:** both approved backend migrations are recorded on staging. No-email HTTP submissions and restricted sequence access are verified remotely; see BACKEND_MIGRATION_DEPLOYMENT_REPORT.md. No placeholder email is fabricated.
