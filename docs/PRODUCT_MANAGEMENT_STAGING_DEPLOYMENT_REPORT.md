# Product management staging deployment

**23 November 2026 · Both approved migrations applied and verified.** Local link metadata and the remote CLI identified VisionTech-Staging, reference `fszrsispjxunckknphaw`. The CLI label `production` identifies the default branch of this staging project.

| Order | Migration | SHA-256 checked immediately before execution | Outcome |
| --- | --- | --- | --- |
| 1 | [20261122000300_product_editor.sql](../supabase/migrations/20261122000300_product_editor.sql) | `31EF51010C7A573BE825633B37A0A8498A1109C5C53E2F6296790AA7D7FF5D54` | Applied. Ledger version 20261122000300, validated retired-model constraint and product save function present. Zero pre-existing rows qualified for archival. |
| 2 | [20261123000100_product_media_security.sql](../supabase/migrations/20261123000100_product_media_security.sql) | `197D641A02DEAD7A3F3C24F29290B681E3E8539EEBD618F55F26C5538C341ADB` | Applied. Ledger version 20261123000100, private bucket, registry, publication view, policies, triggers and corrected RPCs verified. |

The initial SELECT returned the eight approved prerequisite versions, ending in 20261122000200. Candidate functions, table, view, field trigger and constraint were absent. Products, buckets, Storage objects, users, enquiries and admin activity were empty. Relevant RLS, manager function ownership, client restrictions and hosted Storage policy delegation matched the approved preflight.

Supabase CLI 3.1.0 ran from the verified project. The fresh dry run listed the two files above in order and empty role and seed lists. The following deployment command exited **0**.

```powershell
supabase db push --remote=fszrsispjxunckknphaw --skip-vault --workdir 'C:\Vision Tech' --yes
```

```text
Confirmed by --yes: Apply 2 migrations on project VisionTech-Staging (fszrsispjxunckknphaw) · production
Applying migration 20261122000300_product_editor.sql...
Applying migration 20261123000100_product_media_security.sql...
```

The structured result reported `dryRun=false`, the two filenames, empty seeds and roles, and `Finished supabase db push.` Two independent SQL ledger checks, including one after fixture rollback, found ten versions. The catalogue seed, website and hosted editor rollout remain separate. No application deployment, Auth/email configuration change, photo upload or GitHub push was performed.

[Post-deployment security and cleanup evidence](PRODUCT_MANAGEMENT_STAGING_VERIFICATION_REPORT.md) · [Approval baseline](PRODUCT_MANAGEMENT_FINAL_DEPLOYMENT_APPROVAL_REPORT.md)
