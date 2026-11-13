# VisionTech First Administrator Bootstrap Guide

**Status:** No administrator was created or modified.  
**Proposed identity:** `visiontechsolutionsteam@gmail.com` — proposal only; existence and control have not been verified.

## Provisioning design

Supabase Auth owns authentication. A database trigger creates a linked `profiles` row for each Auth user with role `STAFF` and state `DISABLED`. That safe default means an invited user has no admin access until an authorized bootstrap operator activates the exact verified Auth UUID. Public signup must remain disabled unless the business separately approves a controlled registration flow.

The application does not store passwords in source or browser storage. Password creation and reset belong to Supabase Auth's invite/recovery flow. The service-role credential is used only by the server API and never belongs in frontend code.

## One-time Super Admin setup

Complete these steps only after a dedicated staging project exists and its schema/RLS tests pass:

1. Confirm the proposed email is controlled by the business and approved for administrator use.
2. In the Supabase Dashboard for **staging**, invite that email through Authentication. Do not create a password on the user's behalf; let the recipient complete Supabase's invite flow and set their own password.
3. Verify the exact email and Auth user UUID in the private dashboard. Do not paste credentials into source, chat, or documentation.
4. In the private SQL editor, inspect the matching disabled profile before promoting it. Use the exact UUID from the verified Auth record:

   ```sql
   select id, notification_email, role, account_state
   from public.profiles
   where id = '<verified Auth user UUID>';

   update public.profiles
   set role = 'SUPER_ADMIN', account_state = 'ACTIVE'
   where id = '<same verified Auth user UUID>'
     and notification_email = 'visiontechsolutionsteam@gmail.com';
   ```

5. Confirm one row was updated, then test sign-in, session refresh, logout, password recovery, and disabled-account denial against the staging API.
6. Only after staging sign-off, make a separately approved production bootstrap using the production project, verified identity, backup/change record, and deployment controls.
7. Invite additional staff individually. Super Admins may grant ADMIN; Admins may invite/manage STAFF only. Test the role boundary with separate staging accounts.

Do not store the UUID in a public file if it is considered sensitive operational metadata. Do not share passwords or recovery links. Remove or expire unused invitations.

## Current status

The project currently has no configured Supabase URL/keys in this environment, no CLI configuration, and no verified live Auth account. The login email is a proposal only. Account existence, password setup, and login success are unverified. Migration 003's role-boundary fix must be applied and tested in staging before inviting the first user.

See [the account status report](ADMIN_ACCOUNT_STATUS.md) for the previous environment check and [the migration guide](SUPABASE_MIGRATION_GUIDE.md) for the staging sequence.
