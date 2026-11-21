# Enquiry API test report

2026-11-16. Results below distinguish mocks, actual local database and actual staging. No production tests.

| Check | Actual result / evidence |
| --- | --- |
| Node HTTP suite | 18/18 passed with real loopback HTTP and mocked Supabase responses |
| Original local pgTAP suite | 21/21 passed after all five copied migrations |
| New local security suite | 18/18 passed; combined pgTAP output Files=2, Tests=39, Result: PASS |
| Local optional-email HTTP creation | PASS against real disposable Supabase after drafts; blank email persisted and hardened sequence still usable through RPC |
| Staging integration script | PASS, 21 logged check events (includes repeated response secret checks, not 21 independent test cases) |
| Staging data integrity | Exact synthetic name/email/phone/model/message/status checked; SQL-looking text stored literally |
| Staging duplicate retry | Same enquiry code returned; one stored row/outbox |
| Staging persistent limit | Five different valid enquiries saved; sixth rejected HTTP 429 |
| Staging email unavailable | Saved enquiry retained; outbox FAILED recorded; real mail suppressed |
| Unauthorized read | Anonymous Data API returned unauthorized/forbidden for enquiries |
| Browser Contact form | Blank submit showed required-field errors; synthetic valid submit showed pending disabled button, then saved confirmation and reset fields |
| Browser console | No error entries returned during that Contact form test |
| Browser fixture cleanup | One matching synthetic enquiry removed; zero remaining |
| Final staging counts | Auth users/profiles/enquiries/notes/products/activity/notifications/outbox/rate buckets/storage buckets/objects all zero; site_settings seed remains one |
| Secret handling | 58 frontend files compared against configured secret values: zero matches; .env ignored/untracked |
| Original migration integrity | All three SHA-256 hashes match the deployment report |
| Syntax / whitespace | Changed API modules pass node --check; git diff --check passed |

## Reproduce local unit/HTTP tests

```powershell
node --test services/tests/enquiry-api.test.mjs
```

These tests cover normalized valid payload, optional email validator, missing fields, invalid email/phone/types, malformed/non-object JSON, unsupported media, oversized fixed/chunked bodies, XSS markup rejection, parameterized SQL-looking text, origin denial, unauthenticated admin protection, bad idempotency UUID, safe 502/503 failures, invalid storage acknowledgement, database 429 mapping, repeated malformed-request rate limiting, bounded bucket expiry, API-key headers and health/config output.

## Local database tests

Copied config used a unique project_id and no .env/project link. Supabase CLI 3.1.0 started only the disposable LOCAL stack. Five migrations applied successfully in lexical/version order; no original file was renamed. `supabase test db --workdir <disposable directory>` passed both suites. Tests run BEGIN/ROLLBACK; local API fixture records were also removed. The isolated stack was stopped with --no-backup; container and volume filters for vt-prompt5-local-20261116 returned empty. Copied files remain in the named temporary directory for inspection. Unrelated Docker resources were not removed.

## Reproduce staging test (explicitly opt in)

```powershell
$env:VISIONTECH_STAGING_TEST_APPROVAL='fszrsispjxunckknphaw'
node --env-file=.env services/tests/staging-enquiry.mjs
```

The script verifies both configured URL and linked project reference, uses random idempotency keys and an unmistakable synthetic marker, disables mail in memory, uses a fresh rate HMAC secret only in its process, and removes only matching test records and their dependent activity/notifications/outbox/rate bucket. No real users are created. It does not apply migrations. Five API-created sequence numbers were consumed; a separate browser fixture consumed one more. Sequence gaps are expected and were not rewound. Final aggregate read-only verification confirmed all synthetic data removed.

## Browser execution

Used the existing Contact page through a temporary loopback-only static/API test proxy at http://127.0.0.1:4187, pointing at confirmed staging. Actual native/DOM browser interactions filled the form and submitted synthetic data with email. A visible saved confirmation appeared only after the API/database response. The proxy suppressed actual email and was shut down after its scoped cleanup. This validates the Contact form integration with a backend proxy, not a deployed production site or Live Server acting as a backend. No screenshot artifact was saved. The static product enquiry demo modal was not replaced or retested.

## Failures / limitations

- Initial HTTP test execution inside the sandbox failed with connect EACCES on loopback. The same suite passed outside the network sandbox; no code workaround bypassed request security.
- Catalogue regression script first required its --output argument; a subsequent sandbox execution stalled without results and was stopped by its exact process. No catalogue pass is claimed. Product data and assets were not changed.
- Subsequent approved deployment resolved the optional-email and sequence blockers. Hosted suites passed 39/39 and actual HTTP submissions without email passed, with cleanup verified. See BACKEND_MIGRATION_DEPLOYMENT_REPORT.md. Historical pre-deployment results above remain valid.
- No real email delivery, admin login, staff workflow, new-account creation, production hosting, broad responsive regression or exhaustive security audit was performed.
- In-memory limiter resets on restart; database limiter remains persistent. Parallel HTTP duplicate races and every disabled-account policy branch are not covered by this milestone.

External evidence in C:\Users\LEGION\Documents\Codex\2026-11-13\p0-02b-disposable-local-supabase-migration includes prompt5-local-tests.txt, prompt5-sequence-review.json and prompt5-final-counts.json. Staging test output was observed directly in the execution transcript; no credentials were written to these files.
