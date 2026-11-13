# Supabase Migration History

**Checked:** 2026-11-13  
**Remote status:** Unknown; no staging project or credentials are configured.  
**Applied migrations:** None confirmed. Local SQL files are not evidence of remote application.

## Local migration inventory

| Local version / file | Size | SHA-256 | Source review |
|---|---:|---|---|
| `202611120001_secure_admin.sql` | 33,423 bytes | `03920F5F77E1713606ED2429A3BAC13E091D1CF6DF5DA0890B911BBC2C3664C7` | Initial schema, functions, triggers, grants, indexes, RLS policies. Prefix is 12 digits. |
| `202611120002_enquiry_lifecycle.sql` | 7,994 bytes | `DE915F51A7ED7D93D5295F0EB6C17A42C9B7508E5F9018D5DA08BFE9301868B0` | Enquiry lifecycle and staff/admin functions/policy changes. Prefix is 12 digits. |
| `20261112170000_security_hardening.sql` | 5,329 bytes | `40B4A6043313891E270D85B51ADC032E845D6FA50F1701B5D03CB95EA50CFA5A` | Additive enquiry update timestamp; staff elevation and security-definer search-path hardening. Prefix is 14 digits. |

All three files are present under `supabase/migrations/`. The prepared pgTAP suite is `supabase/tests/001_rls_security_test.sql` (21 assertions). No other migration files were found in the directory at the time of this check.

## Filename / ordering review

Filename order is clear locally: migration 001, then 002, then 003. The CLI is available as `npx --yes supabase@3.1.0`, but `migration list` could not reach local Postgres (`ECONNREFUSED 127.0.0.1:54322`), and a local stack did not start. Current Supabase examples use 14-digit timestamp versions. The first two names do not match that canonical format; acceptance by CLI 3.1.0 is **not confirmed**. Do not rename them: remote migration tracking stores version identifiers, and changing a filename changes the version that the CLI compares with the database ledger.

The new 14-digit migration follows the old names lexically. No remote migration list, migration table, or schema dump was obtained. Remote/local consistency is **unknown**, not consistent. A disposable local database test is still needed to observe how CLI 3.1.0 handles all three files; staging still requires inspection of its own migration ledger before any remote apply.

## Destructive-change scan

Static search found no `DROP TABLE`, `DROP SCHEMA`, `DROP COLUMN`, `DROP TYPE`, `DROP DATABASE`, `TRUNCATE`, or standalone `DELETE FROM` data cleanup in these migrations. The initial migration includes a retention cleanup inside the server-side rate-limit function and a guarded enquiry delete RPC; neither is a migration-time data deletion. The lifecycle migration renames an enum value conditionally and adds an enum value/columns. Migration 003 adds a column, replaces a function, replaces a trigger, and changes function settings/grants. Static inspection is not a database validation and cannot establish that the files apply cleanly to an unknown existing schema.

## Reconciliation procedure

Once a dedicated staging project is available:

1. Confirm the project ref/name is staging before authenticating or linking.
2. Install and record the Supabase CLI version.
3. Inspect the remote migration history with `supabase migration list --remote` using the installed CLI's current syntax. Supabase stores applied versions in `supabase_migrations.schema_migrations` and compares timestamps.
4. Inspect existing schema and policies. Do not run `db push` if a version is missing locally, remote versions are unknown, or the schema differs from the expected state.
5. If history differs, capture a read-only schema/history snapshot and identify exactly which migration body ran. Reconcile with a reviewed forward-only migration or a carefully evidenced migration-history repair. Never rename historical files or use `migration repair` just to silence a mismatch.
6. Review a dry-run and confirm it lists only intended staging migrations before applying.

Supabase describes migration history and safe diagnosis in its [database migration guide](https://supabase.com/docs/guides/deployment/database-migrations) and [CLI migration list reference](https://supabase.com/docs/reference/cli/supabase-migration-list).
