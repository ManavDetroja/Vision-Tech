# Private admin dashboard

The dashboard source is vanilla JavaScript in `js/admin/app.js`; HTML shells are under `admin/`. It requires the private Node API and Supabase to be configured and deployed. The static HTML alone does not authenticate users or store enquiries.

## Roles

- `SUPER_ADMIN`: full administration, staff invitation/disable, site settings and enquiry deletion.
- `ADMIN`: enquiry workflow, product/service management and notification retry.
- `STAFF`: assigned enquiry work, notes, status changes and notifications.

Every request validates the Supabase Auth session and active profile on the server. Database policies independently constrain rows. Staff invitation uses Supabase Auth email invitations; disable the profile to block subsequent API requests. Never create shared staff passwords.

## Screens

Sign in: `admin/index.html`; overview: `admin/dashboard.html`; enquiries: `admin/enquiries.html`; record: `admin/enquiry-details.html?id=<uuid>`; catalogue: `admin/products.html`; service content: `admin/services.html`; staff: `admin/staff.html`; notifications: `admin/notifications.html`; activity: `admin/activity.html`; approved public contact settings: `admin/settings.html`.

The unread notification badge refreshes every 60 seconds. Notification records link to their enquiry, and authorized admins can retry a failed email from the enquiry record. Dashboard counts and activity are read from database records; empty data renders as empty states/zero counts.

The admin pages are marked `noindex`, which is not an access control. Private data is returned only by the authenticated API and RLS-protected database queries.

## First super admin

Create one Auth user from the Supabase dashboard, then use the controlled bootstrap SQL at the end of `supabase/migrations/202611120001_secure_admin.sql` to change that exact user's profile role to `SUPER_ADMIN` and state to `ACTIVE`. Confirm the ID from Supabase Auth; do not expose or commit credentials. All subsequent staff access should use the in-dashboard invitation flow.

No fake staff or customer enquiry records are seeded. `services/seed-admin-data.mjs` seeds only the existing 22 products and current services.
