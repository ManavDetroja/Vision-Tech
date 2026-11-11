# Database schema

Apply `supabase/migrations/202611120001_secure_admin.sql` to a dedicated Supabase project only after reviewing it. The migration defines:

- `profiles`: auth-linked identity, role, active/disabled state and work notification address.
- `enquiries`: private customer details, immutable unique enquiry code, idempotency key, timestamp, status and assignment.
- `enquiry_notes`: staff-only notes with author and timestamp.
- `admin_notifications`: per-admin in-dashboard notifications.
- `email_outbox`: durable notification state, retry count, provider ID and failure reason.
- `admin_activity`: protected audit events.
- `submission_rate_limits`: hashed-key submission counters.
- `products`, `service_content`, `site_settings`: admin-managed records exposed publicly only through limited RLS visibility rules.

`submit_public_enquiry` validates inputs again inside PostgreSQL, enforces a hashed network rate limit, writes NEW enquiry plus notifications, outbox and audit event in one transaction, and returns the existing row for a retried idempotency key. The Node server only acknowledges after the database RPC confirms acceptance.

Apply the migration through Supabase SQL editor or an approved database migration process. This repository cannot confirm that the SQL compiles or has been applied until a project is configured. Seed the existing public data with `node services/seed-admin-data.mjs` after setting server environment variables; the script checks for exactly 22 unique product models and does not insert enquiries.
