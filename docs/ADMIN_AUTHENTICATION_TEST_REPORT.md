# Admin authentication test report

Date: 2026-11-18. Target: VisionTech-Staging (`fszrsispjxunckknphaw`). Native Node API, no production changes.

## Executed automated tests

`node --test services/tests/auth.test.mjs services/tests/enquiry-api.test.mjs`

Result: **31 tests passed, 0 failed, 0 skipped**, exit 0. Thirteen authentication tests use a mocked Supabase boundary and real loopback HTTP; eighteen existing enquiry tests protect prior functionality. Authentication checks cover idle/absolute expiry, capacity, recovery expiry/isolation, production/local cookie attributes, legacy-cookie rejection, session rotation, missing/incorrect Origin, network and HTTP 500 outages, invalid refresh, logout-provider failure, uniform reset responses/PKCE challenge, browser-bound code exchange, token substitution rejection and throttling.

Explicit opt-in integration command:

```powershell
$env:VISIONTECH_AUTH_TEST_APPROVAL='fszrsispjxunckknphaw'
node --env-file=.env services/tests/staging-auth.mjs
```

Result: **38 staging checks passed**, exit 0. This script asserts both the environment hostname and local linked reference, provisions only two uniquely named disposable accounts with random in-memory passwords, verifies ownership before deletion, and cleans up only their activity/profile/Auth records. It is not part of the default unit test run.

| Behavior | Evidence and result |
| --- | --- |
| Provisioning ignores forged metadata | Both accounts initially became disabled STAFF despite SUPER_ADMIN user metadata: PASS |
| Valid login | Opaque HttpOnly Strict cookie and authoritative ADMIN profile: PASS |
| Restoration/dashboard | Subsequent session request and private dashboard data: PASS |
| Bad password/nonexistent user | Matching generic 401 responses: PASS |
| Unauthenticated API | Overview, enquiries, products, staff, services, settings, activity, notifications all 401: PASS |
| Forged identity/roles | Unauthenticated staff update 401; STAFF product/admin mutation 403: PASS |
| CSRF | Cross-origin login and private mutation 403: PASS |
| Refresh | Forced expired server metadata exercised genuine Supabase refresh, including concurrent requests: PASS |
| Invalid token | Supabase rejected corrupted access token: PASS |
| Logout | Cookie cleared and captured cookie replay denied: PASS |
| Disabled account | Existing session and fresh login denied: PASS |
| Recovery proof | Genuine generated Supabase recovery token exchanged server-side: PASS |
| Recovery isolation/replay | No admin access from recovery cookie; reused/invalid token rejected: PASS |
| Password update | Real provider update, app-session revocation, new password accepted and old password rejected: PASS |
| Cleanup | Both synthetic profiles absent after Auth deletion: PASS |

The integration test uses administrative `generate_link` solely to obtain a genuine recovery token for a synthetic account. **It does not send email.** End-to-end hosted PKCE email delivery/click/exchange is NOT VERIFIED. Local tests cover the PKCE API contract and missing/consumed browser state. Expired recovery session/token handling is tested with an injected expiry; a real email link was not left waiting until provider expiry. These distinctions are material to acceptance.

## Browser checks actually performed

Used the in-app browser against a temporary loopback static/API preview on port 4196. No UI framework, browser-stored token or production deployment was introduced.

- Login at 1440×900, 768×1024 and 390×844: visually checked, no horizontal overflow (scrollWidth equals viewport width).
- Show/hide password changes input type and accessible pressed state; collapsed recovery form and expansion/focus verified.
- Blank required email blocks submission using browser validation.
- Nonexistent test login shows disabled/loading state, then generic error, cleared password and re-enabled button.
- Invalid recovery code is removed from URL, shows a safe error, and leaves password update disabled.
- Direct signed-out dashboard navigation returns to login with expiry feedback.
- Captured browser warn/error log arrays were empty. This is not a claim of exhaustive browser coverage.
- Valid authenticated dashboard login/logout and password change were verified through real HTTP integration, not through a browser with real credentials.

The preview exposed only selected static folders/file types and API routes, never .env. The preview process was stopped after testing. Screenshots retained outside the repository in the task workspace: `auth6-login-desktop.jpg` and `auth6-login-mobile.jpg`.

## Independent cleanup and secret verification

Read-only staging catalog count query after tests returned: Auth users 0; profiles 0; admin_activity 0; enquiries 0; enquiry_notes 0; notifications 0; email_outbox 0; products 0; service_content 0; rate limits 0; Storage buckets/objects 0. site_settings remains its one existing seed row. No permanent account or test data remains. The CLI calls this staging project's default branch `production`; the exact project name/reference, not that branch label, identify the staging target.

Scanned 59 browser HTML/JS/CSS/config files against the configured server secret, legacy service key, old session key and email API key values: **0 matches**. Values were never printed. This is a targeted current-frontend scan, not a full-history security audit. .env remains Git-ignored and untracked. All five migration SHA256 values match the previously verified values; no migration was edited or applied.

Previous 39/39 SQL security assertions belong to the prior approved backend deployment. They were not rerun or counted as new tests here; no database/RLS changes required them. Current staging does not retain the temporary pgTAP extension.

## Remaining acceptance work

Configure/approve exact hosted recovery redirects and SMTP, supply an approved test inbox, then verify the actual email, browser-bound PKCE exchange, password update and subsequent login. No email-delivery success or production readiness is claimed. HTTPS proxy/cookie behavior, MFA and multi-process operation have not been deployed or tested.
