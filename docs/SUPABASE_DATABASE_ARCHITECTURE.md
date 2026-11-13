# VisionTech Supabase Database Architecture

**Prepared:** 2026-11-12  
**State:** Locally reviewed schema source; no connected Supabase project or applied schema has been verified.

## Existing source reviewed

The project already contains two versioned SQL migrations:

1. `supabase/migrations/202611120001_secure_admin.sql` defines the initial auth-linked admin, enquiry, product-sync, service-content, settings, email-outbox, notification, activity, and rate-limit schema plus RLS and RPCs.
2. `supabase/migrations/202611120002_enquiry_lifecycle.sql` extends enquiry status and follow-up tracking and adds admin/staff workflows.
3. `supabase/migrations/20261112170000_security_hardening.sql` is an additive local hardening migration. It adds enquiry `updated_at`, a timestamp trigger, safer `SECURITY DEFINER` search paths, and the Super Admin-only administrator role grant boundary.

These files show intended database structure. They do not prove that a remote database has these tables or policies. Static catalogue data in `js/data/products.js` remains the public catalogue source; the optional `public.products` table is for admin-managed synchronization and is not a reason to migrate the 22 existing product records as part of P0-01.

## Data model

| Table | Purpose | Main relationships | Access intent |
|---|---|---|---|
| `profiles` | Auth-linked staff identity, role, account state, timestamps | `id` references `auth.users.id` | Authenticated user reads own profile; admins can read staff profiles. Role changes use trusted provisioning/admin path. |
| `enquiries` | Private customer requests and assignment/status lifecycle | `assigned_to` references `profiles.id` | Admin/Super Admin read all; staff read only assigned records. Public inserts go through server-only validated RPC. |
| `enquiry_notes` | Private staff notes | `enquiry_id` and `author_id` reference enquiries/profiles | Admins read all; staff read notes for assigned enquiries. Writes use authorized RPC. |
| `admin_notifications` | Per-user dashboard notifications and read state | `recipient_id` references profiles; optional enquiry reference | Authenticated recipient reads/updates own notification only. |
| `email_outbox` | Durable email delivery status/retries | One row per enquiry | Admin read; service API alone records delivery state. |
| `admin_activity` | Status, assignment, notes, product, and staff audit events | Optional actor/profile and entity ID | Admin reads all; staff read own or assigned-enquiry activity as policy permits. |
| `submission_rate_limits` | Server-side public form rate-limit buckets | No customer profile relationship | No public/authenticated direct access; service API only. |
| `products` | Optional database-backed product records/publication state | `updated_by` references profiles | Public reads published rows only; admins manage through RPC. Current static records remain unchanged. |
| `service_content` | Optional database-backed service content/publication state | `updated_by` references profiles | Public reads published rows only; admins manage through RPC. |
| `site_settings` | Public contact visibility settings | `updated_by` references profiles | Super Admin reads/updates; a restricted public RPC returns only explicitly enabled fields. |

The initial schema uses foreign keys, unique enquiry codes/idempotency keys, note-length checks, product JSON identity checks, and indexes for enquiry status/age/assignee, note chronology, unread notifications, activity chronology, and rate-limit windows. Migration 003 adds an `updated_at` timestamp trigger for enquiry changes.

## Role permissions

| Capability | Super Admin | Admin | Staff | Anonymous |
|---|---:|---:|---:|---:|
| Read all enquiries | Yes | Yes | No | No |
| Read/update assigned enquiry workflow | Yes | Yes | Yes, assigned records | No |
| Assign staff | Yes | Yes | No | No |
| Add/read private notes | Yes | Yes | Yes, assigned records | No |
| Read user-owned dashboard notifications | Own | Own | Own | No |
| Manage product/service records | Yes | Yes | No | No; published records are readable |
| Invite/manage ordinary staff | Yes | Yes, STAFF only | No | No |
| Grant/revoke ADMIN role | Yes | No | No | No |
| Manage a Super Admin profile through staff tools | No | No | No | No |
| Submit public enquiry | Through server API | Through server API | Through server API | Through validated API only |

Every active role comes from the server-read `profiles` row linked to Supabase Auth. The API does not accept a role as authority from the browser. Migration 003 enforces role elevation again inside `admin_set_staff`; the API additionally rejects ADMIN invitations/role changes by ADMIN actors and limits their staff list to STAFF records. A Super Admin profile must be bootstrapped through a private administrative process, not public signup.

## Security design and boundaries

- RLS is enabled on every application table in migration 001. Sensitive tables do not grant anonymous table access; approved writes are implemented by narrowly granted RPCs.
- The public enquiry RPC is `service_role` only. The server API validates the request, enforces origin/size/idempotency/rate-limit rules, and uses server-only service credentials.
- `SECURITY DEFINER` functions are being hardened to use `pg_catalog, public, auth, pg_temp` search paths. Confirm actual definitions and grants on the target Supabase release before deployment.
- `service_role` bypasses RLS and must remain server-only. It is never suitable for browser JavaScript.
- Static admin HTML pages alone do not provide protected route delivery. Private API responses still require authenticated server validation and database policies. Hosting should also protect/redirect the admin shell if confidentiality of its existence matters.
- Role changes, notification delivery, backups, retention, and audit access still require staging and operational verification.

## Known migration compatibility concern

The first two existing filenames use 12-digit migration prefixes. The new hardening migration uses a conventional 14-digit timestamp prefix and sorts later. Do not rename the old files until a target project's `supabase_migrations.schema_migrations` history is checked: a remote may already have recorded their old names. Supabase CLI parsing/history compatibility must be confirmed against the installed CLI before first apply.

## No live data change

No Supabase project was configured, no database connection was attempted, no Auth user was created, and no customer or product rows were migrated. Apply and test only in a dedicated staging project after the migration guide preflight.
