# Staging deployment of enquiry authorization and notifications

**Applied and verified on VisionTech-Staging, 22 November 2026.** The owner explicitly approved the two files below for project reference `fszrsispjxunckknphaw`. The CLI's branch label `production` refers to the default branch within that named staging project.

| Order | Applied migration | Approved SHA-256 |
| --- | --- | --- |
| 1 | `20261122000150_atomic_enquiry_updates.sql` | `6C513B389554C6A8E298F8B772195DB6E9B618D23AFD3F1E5BFCDC1A0296F820` |
| 2 | `20261122000200_notification_delivery.sql` | `966FE7EE1CA61FCAF498443004AAFDBF1B64610796784F1BEA12FE317CF1998D` |

## Preflight and execution

Local link metadata and live catalog output identified the same target. The six original ledger versions, two old function fingerprints, ownership, grants, search paths, notification policies, RLS flags, absence of the candidate objects and empty application baseline matched the review. All eight local migration hashes were checked immediately before the push. The fresh preview listed exactly the approved pair, with empty role and seed lists. [Reviewed preflight](NOTIFICATION_MIGRATION_PREFLIGHT_REPORT.md)

The installed Supabase CLI executed the following commands with the project explicitly pinned. Vault updates were excluded.

```powershell
supabase db push --dry-run --skip-vault --remote=fszrsispjxunckknphaw --workdir 'C:\Vision Tech'
supabase db push --skip-vault --remote=fszrsispjxunckknphaw --workdir 'C:\Vision Tech' --yes
```

Both commands exited 0. Deployment output included:

```text
Applying migration 20261122000150_atomic_enquiry_updates.sql...
Applying migration 20261122000200_notification_delivery.sql...
{"upToDate":false,"dryRun":false,"migrations":["20261122000150_atomic_enquiry_updates.sql","20261122000200_notification_delivery.sql"],"seeds":[],"roles":[],"message":"Finished supabase db push.","target":{"kind":"linked","project_ref":"fszrsispjxunckknphaw","project_name":"VisionTech-Staging","environment":"production"}}
```

Separate read-only queries after deployment and again after fixture cleanup returned the same ledger:

```text
202611120001
202611120002
20261112170000
20261116130000
20261116130100
20261122000100
20261122000150
20261122000200
```

## Catalog verification

All eight deployed `pg_proc.prosrc` bodies matched the approved files after normalizing line endings. All eight were owned by postgres and used SECURITY DEFINER.

| Function group | Search path | Effective execution |
| --- | --- | --- |
| `admin_update_enquiry_status(uuid,text)`, `admin_set_enquiry_follow_up(uuid,timestamptz)`, `admin_assign_enquiry(uuid,uuid)` | pg_catalog, public, auth, pg_temp | postgres, authenticated, service_role. Each returns enquiries and enforces authorization within the function. |
| `claim_notification_delivery(uuid)`, `enqueue_due_followups()` | pg_catalog, public, pg_temp | postgres and service_role |
| `enqueue_notification_delivery()`, `notify_operational_change()`, `reflect_notification_delivery()` | pg_catalog, public, pg_temp | postgres and service_role. Each is attached through a trigger. |

The queue had RLS enabled and zero client policies. Anon and authenticated lacked all four CRUD privileges. Service role held all four. The catalog contained the two inbox columns, three explicit indexes, inbox staff foreign key, queue primary key, two queue source foreign keys, two unique constraints and two check constraints. All five expected triggers were enabled on their intended tables, including both operational-event triggers and legacy outbox reflection. An initial reporting check interpreted a PostgreSQL identifier array as a JSON list. Explicit JSON aggregation confirmed all three indexes and the complete catalog comparison passed.

This deployment covered the database. Hosted Auth, sender configuration, website deployment, production and GitHub were outside the operation. The staging behavioral checks and cleanup evidence are recorded in the [verification report](NOTIFICATION_STAGING_VERIFICATION_REPORT.md).
