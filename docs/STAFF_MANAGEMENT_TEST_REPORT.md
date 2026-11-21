# Staff management test report

Date: 2026-11-22. Tests distinguish local provider/database evidence, mock-boundary unit tests, fixture UI checks and remote read-only observations.

## Local JavaScript tests

Command from `C:\Vision Tech`:

```powershell
node --test services/tests/auth.test.mjs services/tests/enquiry-api.test.mjs services/tests/staff.test.mjs
```

**36 passed, 0 failed, 0 skipped.** Existing 13 authentication and 18 enquiry regressions stayed green. Five new tests cover role/target restrictions, central private-route permissions, invitation lifecycle states, typed input rejection and configuration gating before any Auth call. JavaScript syntax and Git whitespace checks passed; Git emitted only normal LF/CRLF conversion notices.

## Real local Supabase integration

Existing disposable environment: `C:\Users\LEGION\AppData\Local\Temp\VT_PROMPT5_LOCAL_20261116`. Docker was initially stopped; the installed Docker Desktop was launched and this existing stack started **without reset**. The test never loads the project .env, derives local keys from CLI status in memory, and asserts both API/database hostnames are `127.0.0.1` before doing anything.

`services/tests/staff-local.mjs` requires VISIONTECH_LOCAL_WORKDIR and VISIONTECH_LOCAL_CLI explicitly. **44 checks passed, exit 0.**

| Area | Actually verified |
| --- | --- |
| SUPER_ADMIN | Directory, settings, ADMIN grant, protection from self-demotion/deactivation |
| ADMIN | STAFF-only directory, STAFF activation/deactivation, inability to view Super Admin details/change ADMIN/grant ADMIN |
| STAFF | Direct directory/products/settings/assignment denied; assigned enquiry read/status/note allowed; another enquiry read/write denied |
| Escalation | Forged desired SUPER_ADMIN rejected; self-edit denied; direct PostgREST profile update denied |
| Disabled account | Existing opaque session revoked; fresh login forbidden; reactivation succeeds |
| Confirmation/CSRF | Missing confirmation rejected; cross-origin mutation denied |
| Invitation | ADMIN can invite STAFF; ADMIN cannot invite ADMIN; STAFF cannot invite; existing account not overwritten |
| Delivery | Genuine Supabase invitation delivered to local SMTP sink only |
| Acceptance | Provider invite token verified server-side; setup cookie cannot access dashboard; password set; subsequent login works |
| Token safety | No access/refresh/invite token fields or configured secret in API responses; replay and invalid token rejected |
| Expiry | Server-owned invitation deadline injected into the past; completion rejected even with a valid provider access token |
| Audit | Transactional staff changes, permission denials and invitation records found |
| Cleanup | All test-owned Auth users and their profiles removed; enquiry/note/notification/outbox/activity fixtures removed |

Passwords and tokens were random and retained only in test process memory. Tests created temporary local SUPER_ADMIN/ADMIN/STAFF fixtures; no remote or real administrator was created. Email token extraction used the local message in memory; it did not click a configured hosted custom-template email or wait an hour for natural provider expiry. These are not hosted email acceptance results.

## PostgreSQL/RLS tests

The local runner used `docker exec -i supabase_db_vt-prompt5-local-20261116 psql -U postgres -d postgres -v ON_ERROR_STOP=1 -At`, feeding each original test file with the pending policy inserted immediately after BEGIN. The actual migration file was used, not a substitute policy. Every run ends ROLLBACK.

| Suite | Passed | Failed | Rolled back |
| --- | ---: | ---: | --- |
| 001_rls_security_test.sql | 21 | 0 | Yes |
| 002_enquiry_api_security_test.sql | 18 | 0 | Yes |
| 003_staff_permissions_test.sql | 12 | 0 | Yes |
| Total | 51 | 0 | Yes |

Baseline reproduction without the new policy: `disabled_visible_before=1`. With the actual restrictive policy: disabled-account private activity count 0; active STAFF own activity count 1. New assertions also verify service-only staff RPC permissions, ADMIN self/escalation denial, last Super Admin protection, allowed activation/promotion and transactional activity history.

Independent local counts after cleanup: Auth users 0, profiles 0, admin_activity 0, enquiries 0; `activity_requires_active_account` persisted false. No reset or remote migration occurred. The SQL tests' transaction-local pgTAP extension/fixtures and policy were rolled back. Sequence gaps from local enquiry tests are harmless and were not reset.

## Browser checks

In-app browser used the actual HTML/CSS/JS against an isolated loopback fixture server on port 4197. It used clearly synthetic `example.invalid` staff rows outside the project/database and no secrets. This validates UI behavior; real authorization is evidenced separately above.

- Search narrowed three fixture rows to the technician.
- Account dialog showed distinct sign-in/notification email, role/state and activity.
- Accessible HTML confirmation dialog showed the proposed role/state; Cancel returned to editing without saving.
- STAFF navigation excluded staff/products/services/settings and direct staff-page rendering showed a denial.
- ADMIN role controls contained STAFF only and business settings navigation was absent.
- Missing invitation token showed safe feedback with completion disabled.
- Desktop 1440×1000, tablet 768×1024 and mobile 390×844 reviewed. Narrow tables scroll within their container; document width did not exceed viewport width. Disabled invitation control is visibly disabled.
- Captured browser warning/error logs were empty. No full automated accessibility audit or hosted-browser email/password setup was performed.

Screenshots outside the repository: `staff7-desktop.jpg` and `staff7-mobile.jpg` in `C:\Users\LEGION\Documents\Codex\2026-11-13\p0-02b-disposable-local-supabase-migration`. Full-page screenshot calls timed out; supported viewport screenshots were captured instead. The preview server was stopped and browser viewport override reset.

## Remote observations and security checks

Explicit read-only staging target: `fszrsispjxunckknphaw`; CLI labels its default project branch "production", but project identity is VisionTech-Staging. Observed ledger: 202611120001, 202611120002, 20261112170000, 20261116130000, 20261116130100. No new version applied. Roles match exactly; Auth users/profiles remain 0. Remote old permissive activity policy confirms the gap still needs the approved restriction.

All five previously deployed file hashes match prior reports. New migration is separate. Real .env ignored/untracked and unmodified. Current frontend secret-value scan: 62 files, zero matches; this is not a full Git-history audit. Existing unrelated working changes preserved.

## Not yet verified / blockers

- Pending restrictive policy applied and tested on staging: **not performed; approval required**.
- Hosted invite/recovery SMTP delivery and actual browser email-link round trips: **not performed**; approved settings/inbox needed.
- Default local SMTP mail was tested; proposed custom template installation remains an owner-approved hosted configuration step.
- No real bootstrap, production deployment, multi-process session store or MFA test.

Do not aggregate local SMTP evidence into a claim of successful hosted email delivery or production readiness.

## Resumed final verification — 2026-11-22

The previous final cleanup command was not executed because automatic approval review hit a usage limit. After the owner's continuation request, the checks completed successfully:

- Independent local counts: Auth users, profiles, enquiries, notes, notifications, email outbox, activity, products, service content, rate limits and Storage buckets/objects all 0; existing site_settings seed remains 1; pgTAP extension absent.
- Local SMTP mailbox contains 0 test-owned `vt-staff7-` messages.
- Removed only this task's private local CLI startup capture outside the repository; no key values were displayed.
- Stopped only `vt-prompt5-local-20261116` using Supabase stop, preserving its database storage. No reset or volume deletion.
- Re-ran all 36 JavaScript tests: 36 passed, 0 failed/skipped. Nine changed API/frontend modules passed Node syntax checks. `git diff --check` passed, with only LF/CRLF conversion notices.
- No remote migration, account provisioning, hosted configuration change, commit or push was performed during this continuation.
