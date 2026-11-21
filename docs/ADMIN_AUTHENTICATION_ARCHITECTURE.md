# Admin authentication architecture

Reviewed 2026-11-18 for Prompt 6. Staging: VisionTech-Staging (`fszrsispjxunckknphaw`). No production deployment or database migration in this milestone.

## Boundary and components

The existing native Node HTTP API and Supabase Auth remain the authentication boundary. The HTML pages are public shells; all private records require authenticated API access. Browser redirects improve usability but never authorize a request.

| Component | Responsibility |
| --- | --- |
| `services/api/auth-routes.mjs` | Login, logout, reset request, recovery exchange and password update |
| `services/api/auth.mjs` | Trusted Supabase user validation, refresh and authoritative profile checks |
| `services/api/session-store.mjs` | Opaque, revocable, bounded process-memory sessions and cookies |
| `services/admin-api.mjs` | Existing private API dispatch, central authorization and mutation Origin check |
| `js/admin/app.js` | Login state, loading/error feedback, session restoration and logout |
| `js/admin/password-reset.js` | Recovery-link exchange and password confirmation UI |
| `js/admin/password-controls.js` | Accessible password visibility controls |

## Session choice

The prior encrypted cookie carried Supabase tokens. This milestone replaces it with a random 32-byte opaque session ID; access/refresh tokens remain in Node memory. Server deletion immediately prevents replay of a logged-out cookie, even if provider revocation fails. Existing encrypted cookies are deliberately rejected and require a fresh login.

Admin sessions have an eight-hour absolute limit and a thirty-minute sliding inactivity limit. API requests, including dashboard notification polling, count as activity; this is not a measure of physical user interaction. Recovery-request state lasts thirty minutes; recovery completion sessions last ten minutes or the provider token expiry, whichever is earlier. The store caps all entries at 2,000 and prunes expired entries.

Cookies are host-only, `HttpOnly; Path=/api; SameSite=Strict`, with bounded Max-Age. `NODE_ENV=production` adds `Secure`. Local HTTP testing omits Secure. Use HTTPS and a same-origin reverse proxy for hosted use. Cross-site frontend/API deployments are incompatible with Strict cookies; do not loosen them as an incidental workaround. Cookies are never read by frontend JavaScript or stored in localStorage/IndexedDB.

This is intentionally a **single Node process** design. Restart signs everyone out and invalidates pending recovery attempts. Do not deploy multiple workers, horizontal replicas or ephemeral serverless functions without an approved shared session store and distributed throttles. Tokens exist in server memory and must be protected by host access controls. A stolen opaque cookie remains a bearer credential until invalidated or expired.

## Login and authorization

1. Exact allowed Origin, JSON/body limits and bounded IP/account throttles are checked.
2. Supabase password grant authenticates the supplied credentials.
3. Supabase `/auth/v1/user` validates the access token. Identity is not taken from browser data or locally decoded unverified JWT claims.
4. The API retrieves `public.profiles` using the user's bearer token, respecting RLS. The profile must be ACTIVE with an existing allowed role.
5. `record_own_login()` records login activity. The current browser session ID is invalidated and a fresh unpredictable ID is issued.
6. Each protected request verifies the Supabase user and current database profile again. Near-expiry tokens refresh server-side; concurrent refresh requests share one refresh operation.

Missing/invalid sessions return 401. Active users without route permission return 403. Disabled profiles lose their app session and receive 403. Supabase transport/5xx failures return 503 without treating an outage as invalid credentials. Existing SUPER_ADMIN/ADMIN/STAFF restrictions and database policies remain unchanged. Public endpoints expose only their existing published records/settings.

Private mutations additionally require the exact configured Origin; unauthenticated private calls are rejected before mutation authorization. Auth mutations also enforce Origin. SameSite cookies and JSON content types provide additional protection. Authentication throttles are 40 attempts/IP/15 minutes, 10 login attempts/account/15 minutes and 3 reset requests/account/hour; provider rate limits apply independently. Buckets use HMAC identities and bounded memory. Distributed abuse protection remains a hosting prerequisite.

Logout first deletes the application session, clears its cookie and then requests Supabase local-scope revocation. `providerRevoked` reports whether the provider acknowledged revocation. UI redirects only after app logout is acknowledged; network failure offers retry. Password changes revoke all application sessions for that user and request provider global logout. Provider JWTs can otherwise remain valid until their expiry; this is why application revocation is enforced locally. See [Supabase sign-out guidance](https://supabase.com/docs/guides/auth/signout).

## Password recovery

- Reset request returns a uniform conditional 202 response without disclosing account existence or claiming email delivery. Provider failure is logged as a fixed event/status only; transport failures return a safe 503.
- The server creates a PKCE verifier, retains it in a separate request session and sends only its challenge to Supabase `/recover` with the exact reset-page redirect.
- The email link must open in the requesting browser. The frontend sends its `code` to the API; the API exchanges it using the stored verifier and consumes the request state.
- An optional Supabase custom recovery-email template can send a `token_hash` to the reset page. The API verifies it with Supabase as type `recovery`; it never accepts an arbitrary browser access token as recovery proof.
- Verified recovery identity must have an ACTIVE authorized profile. The issued recovery cookie cannot access admin routes. Password update requires this cookie, another trusted identity/profile check, and a password of 12–256 characters. Supabase enforces its configured password policy too.
- The reset page removes query/fragment credentials from the address bar immediately, uses no-referrer and persists no token. Old implicit `access_token` links are unsupported; request a new recovery email.
- Query credentials can reach reverse-proxy access logs before URL removal. Redact query strings on auth pages; prefer a custom fragment-based token-hash link if the owner approves that template.

See [PKCE flow](https://supabase.com/docs/guides/auth/sessions/pkce-flow), [redirect allowlists](https://supabase.com/docs/guides/auth/redirect-urls), and [Auth SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

## Environment and hosted settings

Load `C:\Vision Tech\.env` explicitly with `node --env-file=.env services/admin-api.mjs`. Required: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY, APP_ORIGIN and RATE_LIMIT_HASH_SECRET. Existing legacy key fallbacks remain. Publishable/secret keys use `apikey`; only user JWTs are user Authorization bearer tokens. No secret key is sent to the browser. SESSION_ENCRYPTION_KEY is obsolete; the real .env was not edited. Auth recovery email is configured in Supabase, independently of the enquiry email provider.

Read-only staging config inspection found site_url `http://localhost:3000`, no additional redirect URLs, public signup enabled, and email confirmations enabled. These settings were **not changed**. Before email acceptance testing, the owner must configure the actual staging frontend origin and exact `<APP_ORIGIN>/admin/reset-password.html` redirect, a permitted SMTP sender and an approved test inbox. Avoid wildcard redirects. Recommend disabling public signup for this staff-only system; the existing trigger still defaults every new account to disabled STAFF regardless of user metadata.

No MFA challenge UI is implemented. Do not claim MFA enforcement or enable an unsupported mandatory challenge flow without implementation/testing. No real administrator exists after fixture cleanup; use the separate owner-controlled bootstrap guide.
