# Role-based access control

Reviewed 2026-11-22, Prompt 7. Target for remote read-only inspection: VisionTech-Staging, `fszrsispjxunckknphaw`. The deployed PostgreSQL enum exactly matches SUPER_ADMIN, ADMIN and STAFF; no new role values were introduced.

## Permission matrix

All roles require a trusted Supabase user and ACTIVE database profile. Browser-supplied roles, IDs and metadata never authorize a request.

| Capability | SUPER_ADMIN | ADMIN | STAFF |
| --- | --- | --- | --- |
| Operational dashboard | All operational records | All operational records | Assigned enquiries/own notifications and permitted activity |
| Enquiry reading/status/follow-up/notes | All | All | Assigned enquiries only |
| Assign enquiries | Yes | Yes | No |
| Delete enquiries | Yes, explicit confirmation | No | No |
| Product/service management and email retry | Yes | Yes | No |
| Private business settings | Yes | No | No |
| Staff directory/details API | All profiles | STAFF profiles only | No |
| Invite ADMIN | Yes | No | No |
| Invite STAFF | Yes | Yes, existing business model | No |
| Change ADMIN role/details/state | Other ADMIN accounts | No | No |
| Change STAFF role/details/state | Yes, including ADMIN grant | STAFF remains STAFF | No |
| Edit own account through staff tools | No | No | No |
| Create/edit/deactivate SUPER_ADMIN through ordinary endpoints | No | No | No |

The last active Super Admin is protected by rejecting **every** ordinary mutation of a Super Admin profile. First Super Admin provisioning remains a separate owner-approved administrative procedure; no real privileged account was created. Synthetic Super Admin fixtures existed only in disposable local tests and were removed/rolled back.

## Enforcement

`services/api/permissions.mjs` defines the central private-route gate and allowed staff targets. `actorFor` retains the Prompt 6 trusted user verification, refresh handling and live profile checks. Each private route is authenticated first; the permission gate returns 403 before prohibited operations. Cookie-authenticated mutations enforce exact Origin. Frontend navigation/control filtering is usability only.

`staff-service.mjs` validates typed input, rejects arbitrary role values, self-edits and protected targets, and uses the existing service-only `admin_set_staff` RPC. The RPC repeats actor state/role and target restrictions in PostgreSQL and writes STAFF_SETTINGS_CHANGED in the same transaction as the profile update. Notification email is distinct from Supabase sign-in email; editing it does not transfer identity. No user-deletion endpoint was introduced. Successful changes revoke the target's in-process application sessions; subsequent authorization also rechecks current database state.

Most private queries use the user's JWT and RLS. Service credentials are limited to Auth administration, the existing staff RPC and audit insertion. Direct authenticated profile updates and calls to service-only staff RPCs remain prohibited. Existing profile RLS allows active admins to read profiles more broadly than the STAFF-only management directory; this existing database read permission was not silently changed. STAFF can read their own profile, including when disabled, so the API can identify disabled access; that is not permission to read customer data.

## Invitations

Only roles permitted by the actor are accepted; SUPER_ADMIN is never an ordinary invitation target. Auth email, not editable notification_email, is checked for existing accounts. A bounded paginated Auth scan fails closed if absence cannot be established. Single-process duplicate requests are locked by normalized email. Returned Auth identity must match the request's random creation nonce before any role assignment, preventing a concurrently discovered existing unconfirmed user from being promoted. The nonce grants no authority and is not an invitation secret.

Supabase sends the invite; the API creates no default password and returns no token/link. The owner-configured invite template passes the provider token hash directly to the acceptance page in a fragment. The server verifies it as an **invite** with Supabase, checks current ACTIVE profile and allowed role, then issues a ten-minute setup-only opaque session. It cannot read the dashboard. Password setup enforces 12–256 characters plus provider policy, consumes app sessions, records completion and requests provider global logout. The employee then signs in normally.

Server-only Auth app_metadata stores requested/expiry/completion timestamps, not authority. Link/setup deadline is one hour from issuance, or earlier provider expiry. Reused, invalid, expired, completed and disabled-account invitations are rejected. User-editable metadata cannot replace this state. The status display distinguishes NOT_INVITED, UNTRACKED, UNKNOWN, PENDING, VERIFIED, COMPLETED and EXPIRED; provider delivery is never inferred from a folder, status label or API acknowledgement.

Auth email delivery, profile update and activity insertion are separate services/transactions. Partial failure is reported as an error, leaves an account for review and never deletes/reassigns it automatically. Audit request/incomplete events support diagnosis. Existing-account invitation retries are rejected; expired/untracked/partial accounts require authorized review rather than an automatic role overwrite. No resend UI is implemented in this milestone.

## Audit behavior

Existing `admin_activity` is reused. Events: STAFF_INVITE_REQUESTED, STAFF_INVITATION_SENT, STAFF_INVITATION_INCOMPLETE, STAFF_UPDATE_REQUESTED, existing STAFF_SETTINGS_CHANGED, STAFF_INVITATION_COMPLETION_REQUESTED, STAFF_INVITATION_COMPLETED and PERMISSION_DENIED. Values are fixed action names, trusted actor/target IDs and role/state transitions; no password, token, API key, raw request body or raw URL is recorded.

Mutation-request audit writes must succeed before a sensitive operation begins. Successful role/state changes retain the transactional RPC event. Authenticated permission denials are written to the database; if that write fails, the operation is still denied and a safe structured operational error is logged. Anonymous/invalid-session requests return 401 without inventing an actor or creating unlimited anonymous database audit rows. An infrastructure outage can prevent a durable denial record; monitoring of the safe failure log is required.

## Pending RLS restriction — not deployed

Remote read-only inspection confirmed that `activity_read_admin_or_actor` permits `actor_id = auth.uid()` without an active-account condition. Local reproduction returned one old activity row for a disabled account. The API already denies that account, but direct Supabase reads with an unexpired JWT need database protection too.

Prepared `supabase/migrations/20261122000100_staff_activity_access.sql`, SHA256:

`E8580798304C7DB4D3E4AFCDD4C693F83D610E499F7564B9DEE73048AA8EBC79`

It adds one **restrictive SELECT policy** on admin_activity requiring `is_active_account()`. Existing permissive scopes remain and are intersected with this condition. No grants, table data, enum, Auth schema, function or original migration changes. All 51 local pgTAP assertions pass with it, including zero visible activity rows after deactivation. Tests rolled back the policy. It is **not applied locally persistently or remotely**. Prompt 7 Task 8 requires explicit approval before staging application.

No production-readiness claim until the restriction and hosted invitation/recovery email round trips are approved and verified. Single-process session/rate-limit constraints from Prompt 6 remain.
