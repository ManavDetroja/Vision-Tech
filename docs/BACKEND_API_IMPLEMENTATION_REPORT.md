# Backend API implementation report

2026-11-16. **Implementation complete; both backend migrations were explicitly approved, deployed and verified on staging.** See BACKEND_MIGRATION_DEPLOYMENT_REPORT.md for 39/39 hosted security assertions and no-email HTTP verification.

## Completed

Inspected existing Node server, private/public routes, environment loading, Supabase REST headers, enquiry RPC/table schema, validation, rate limits, frontend and deployment reports. Kept the native Node backend and dependency-free HTML/CSS/vanilla JS frontend. No package.json/framework/build tooling was introduced.

Extracted shared config/constants, bounded JSON/error utilities, Supabase client, existing session/role middleware, validation, rate limiter and public enquiry routing/service modules. Existing private routes remain behind actorFor and active role checks. No new public admin endpoints or accounts.

Public enquiry API now validates types/lengths/phone/email/plain text, normalizes input, rejects malformed/oversized/unsupported bodies, uses bounded pre-database rate limiting plus existing persistent RPC limits, checks complete storage acknowledgement, returns consistent JSON statuses and redacted failures, and preserves notification-failure durability. Health performs a cached safe connectivity check without revealing configuration names, keys or infrastructure.

Contact form uses same-origin /api/enquiries, accepts optional email, verifies the database acknowledgement fields and does not claim a connection simply from configured URL. Browser-tested successful staging save with email. No design redesign, product edits or contact detail publication.

## Files modified

- services/admin-api.mjs â€” reuse extracted modules, public dispatcher, safe server error boundary and timeouts.
- contact.html â€” optional-email label/requirement.
- js/data/contact-config.js â€” same-origin enquiry endpoint.
- js/features/contact.js â€” accurate availability, strict success acknowledgement and feedback.
- docs/CONTACT_FORM.md, docs/DEPLOYMENT.md, docs/ENQUIRY_WORKFLOW.md â€” current integration/status notes.

## Files added

- services/api/config.mjs
- services/api/constants.mjs
- services/api/http.mjs
- services/api/supabase.mjs
- services/api/auth.mjs
- services/api/validation.mjs
- services/api/rate-limit.mjs
- services/api/enquiry-service.mjs
- services/api/public-routes.mjs
- services/tests/enquiry-api.test.mjs
- services/tests/staging-enquiry.mjs
- supabase/migrations/20261116130000_enquiry_sequence_privileges.sql (approved and deployed to staging)
- supabase/migrations/20261116130100_optional_enquiry_email.sql (approved and deployed to staging)
- supabase/tests/002_enquiry_api_security_test.sql
- docs/BACKEND_API_ARCHITECTURE.md
- docs/BACKEND_API_IMPLEMENTATION_REPORT.md
- docs/ENQUIRY_API_TEST_REPORT.md
- docs/ENQUIRY_SEQUENCE_PERMISSION_REVIEW.md

## Verified results

18/18 HTTP tests passed; 39/39 local pgTAP assertions passed (21 original + 18 new). Actual local HTTP creation without email passed after draft migrations. Staging integration completed 21 logged check events, with exact storage/duplicate/rate/anonymous-access checks and cleanup. Browser Contact submission succeeded and its fixture was removed. Final staging counts show no users or synthetic records left. Both migrations were subsequently approved and deployed; all hashes remain unchanged. See the deployment report for current remote verification. See ENQUIRY_API_TEST_REPORT.md for precise coverage and failed tooling attempts.

## Remaining prerequisites and decision

1. Completed: both reviewed migrations were explicitly approved and deployed. Remote sequence grants are restricted and absent email is accepted without fabricated values.
2. Completed: remote ledger/permissions and no-email HTTP submission were verified, with all synthetic data removed. Keep applied migration files unchanged.
3. Hosting still requires Node behind an HTTPS /api reverse proxy and exact APP_ORIGIN; Live Server alone cannot save. No production website was deployed and no public production form was enabled remotely.
4. Email configuration and actual delivery, full admin login/staff regression, disabled-account policy coverage and broader rate-limit/concurrency testing remain separate work. Existing private functionality was preserved, not certified end-to-end without accounts.

.env and .env.example were not modified. Secrets remain server-side, .env ignored/untracked. No dependency installed, production touched, migration repaired/reset, commit or GitHub push. Pre-existing untracked staging readiness/recovery/deployment reports were preserved.
