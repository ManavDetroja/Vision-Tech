# Product Management — final staging deployment approval report

**Subsequent outcome, 23 November 2026.** The owner approved both migrations and the staging deployment succeeded. [Deployment report](PRODUCT_MANAGEMENT_STAGING_DEPLOYMENT_REPORT.md) · [Verification and cleanup](PRODUCT_MANAGEMENT_STAGING_VERIFICATION_REPORT.md). The baseline below describes the pre-deployment state.

**23 November 2026 · VisionTech-Staging · `fszrsispjxunckknphaw`**

**Decision: READY FOR STAGING APPROVAL for the two database migrations below.** Supabase CLI 3.1.0 previewed exactly the reviewed pair. Independent read-only SQL queries returned the same eight remote versions before and after the preview. Staging contains zero products and zero buckets. The catalogue seed and hosted editor rollout require separate decisions.

## Approval scope and file integrity

| Order | Version | Exact migration | SHA-256 of local file |
| --- | --- | --- | --- |
| 1 | `20261122000300` | [20261122000300_product_editor.sql](../supabase/migrations/20261122000300_product_editor.sql) | `31EF51010C7A573BE825633B37A0A8498A1109C5C53E2F6296790AA7D7FF5D54` |
| 2 | `20261123000100` | [20261123000100_product_media_security.sql](../supabase/migrations/20261123000100_product_media_security.sql) | `197D641A02DEAD7A3F3C24F29290B681E3E8539EEBD618F55F26C5538C341ADB` |

The migration directory contains ten files. Both pending byte hashes matched the Prompt 11B report and were checked again immediately before the preview. The first file is the pending Prompt 11 prerequisite; the second is the Prompt 11B correction. The second delegates both legacy write functions to the editor RPC created by the first. Prior disposable execution applied all ten in this order. [Previous local test and migration results](PRODUCT_MANAGEMENT_FINAL_STAGING_PREFLIGHT.md)

## Fresh staging evidence

Both local link files identified the requested project. Each remote CLI operation used its explicit reference, and the remote banner confirmed the name and reference. The banner's `production` suffix labels the default branch **within VisionTech-Staging**.

| Independent catalog observation | Before preview, 03:24:39 IST | After preview, 03:25:21 IST |
| --- | --- | --- |
| Remote ledger count | 8 | 8 |
| Either candidate version recorded | Neither | Neither |
| Product rows | 0 | 0 |
| Storage buckets | 0 | 0 |
| public.product_media exists | False | False |

Both ordered ledger reads returned exactly:

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

The installed CLI ran the following command. It exited **0**. The complete migration-selection output follows; the only additional CLI notice advertised an optional update to v3.2.0.

```powershell
supabase db push --remote=fszrsispjxunckknphaw --dry-run --skip-vault --workdir "C:\Vision Tech" --output-format text
```

```text
Target: project VisionTech-Staging (fszrsispjxunckknphaw) · production
Initialising login role...
DRY RUN: migrations will *not* be pushed to the database.
Would push these migrations:
 • 20261122000300_product_editor.sql
 • 20261123000100_product_media_security.sql
Finished supabase db push.
```

The post-preview result came from a **separate CLI process**, using `db query --read-only` against the same explicit reference. It queried `supabase_migrations.schema_migrations` directly. No unexpected file was selected. The SQL review found the changes inventoried below. The preview proves migration selection; hosted execution, resulting ownership and post-install behavior can only be verified after approval.

## Dependencies, permissions and expected changes

| Area | Finding |
| --- | --- |
| Existing baseline | The catalog confirmed public.products, public.profiles, public.admin_activity, storage.buckets, storage.objects and auth.uid(). All five relations have RLS enabled. Both legacy product RPCs and current_admin_role() are owned by postgres and use the fixed search path below. The role helper reads only the ACTIVE profile matching auth.uid(). |
| Name collisions and data impact | The candidate save/review/guard functions, product constraint, field trigger, registry and public media view were absent. No existing policy on storage.objects or storage.buckets was returned. Zero visible retired rows currently qualify for archival. Recheck if staging changes before deployment. |
| First migration | Conditionally archives three retired model codes, adds the visibility CHECK and creates the version-checked product save function. It validates identity and taxonomy, locks edited rows, checks the expected timestamp and records the actor in admin activity. Constraint validation takes a table lock. No baseline records are inserted. |
| Second migration | Creates one private bucket, one restrictive Storage policy, the media registry and its manager-read RLS policy, the independent review RPC, two trigger functions and triggers, and a security-barrier publication view. Replaces both legacy product functions with delegates. Legacy updates must supply the expected version. Keep the editor unavailable if only the first migration succeeds. |
| Table access and protected fields | Live products SELECT permits published rows or active ADMIN/SUPER_ADMIN. Neither anon nor authenticated has direct product mutation privileges, public-schema CREATE, superuser or BYPASSRLS. For an end-user write, the proposed table trigger compares protected JSON fields against their prior values and validates model-specific media attachments. Ordinary edits cannot confer verification or image rights. Changes to technical facts invalidate prior verification. Trusted database maintenance and bootstrap use privileged access. |
| Roles, ownership and grants | Active ADMIN/SUPER_ADMIN may edit ordinary fields. STAFF and anonymous callers cannot manage products. Legacy RPCs retain authenticated execution subject to role checks. The new save and review functions revoke public/anonymous execution. The review function requires an active SUPER_ADMIN, a nonempty evidence reference and a reviewer different from the uploader for an approval. Withdrawal records the actor and reason. The registry grants the service role SELECT and column-limited INSERT; client roles cannot directly write approval fields. |
| Function safety | All six relevant write/review/trigger functions pin `search_path = pg_catalog, public, auth, pg_temp`. The product field guard is an invoker. The registration guard, review RPC and three product-write RPCs are definers. The Prompt 11B local catalog found all six owned by postgres and neither trigger function executable by clients. New hosted objects will belong to their creating role; verify this and their effective ACLs after deployment. |
| Storage DDL compatibility | Live storage.objects belongs to supabase_storage_admin. Staging's `supautils.policy_grants` explicitly delegates policy management on storage.objects to postgres. The catalog also confirmed postgres bucket INSERT, public-schema CREATE, the five bucket columns used and the UUID generator. This supports the proposed policy without ownership changes. [Supautils policy grants](https://github.com/supabase/supautils#manage-policies) |

## Private image delivery and hosting

The candidate bucket is `visiontech-product-media`, with `public=false`, an 8 MiB object ceiling and allowed JPEG, PNG and WebP MIME types. The API accepts source files up to 4 MiB and verifies decoded content with Pillow. The restrictive policy blocks direct object operations for anon and authenticated users in this bucket. The backend uses server credentials for immutable Storage writes. Approved and private bytes are kept outside the static deployment.

Public delivery checks the approved-media view for the requested UUID on each request. Eligibility requires approval, a visible product of the same model, and attachment to that record. The API reads only the normalized JPEG on this route, verifies its SHA-256 and returns `private, no-store`. A separate role-checked endpoint provides manager previews. No public bucket, original-byte endpoint, or client write grant was found. Product records may expose attachment IDs; knowing an ID does not authorize a download. Serve only the packaged static directory so the original archive cannot be fetched directly. [Storage implementation and restore procedure](PRODUCT_IMAGE_STORAGE_IMPLEMENTATION_REPORT.md)

The backend needs HTTPS, a same-origin /api proxy, Node, Python/Pillow, outbound Supabase access and enough request capacity for the **5,700,000-byte JSON envelope**. Set timeouts for decoding and Storage access. Supply `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `APP_ORIGIN` and `RATE_LIMIT_HASH_SECRET` on the server. Use `VISIONTECH_PYTHON` when the decoder interpreter is outside PATH. The backend also recognizes the documented legacy key aliases. Hosted secret values, sender settings and deployed host configuration were outside this review.

## Seed readiness

Read-only comparison matched the JSON catalogue, seed allowlist and documented identities: **19 unique products** across IP cameras (7), Wi-Fi cameras (2), 4G cameras (3), solar (1), NVRs (4) and PoE switches (2). IDs match their lowercase model codes. CP-Z42Q, CP-UNC-DA41L3C-Q2 and CP-DNW-HPU8G2-6-V3 are absent. All 19 source records carry pending commercial image permission.

The separate seed validates model/category relationships and inserts only missing IDs using `resolution=ignore-duplicates`. Existing edits and archive decisions retain their stored values. A conflicting model under a different ID requires investigation. New records become visible with placeholders because the seed strips image fields and attachment lists. The Prompt 11B local rerun preserved an administrator's edited name and archived visibility. **No seed was executed in this review.** [Catalogue seed plan](PRODUCT_CATALOGUE_SEED_PLAN.md)

## Owner decisions and recovery

1. **Database approval:** authorize only the two named hashes on the specified staging project. Confirm the current recovery point and repeat the preflight if files, ledger or baseline change. If a migration fails, stop and inspect the ledger before any recovery decision. One file can already have committed when the next fails.
2. **Backup custody:** choose an encrypted, access-controlled destination outside the repository and deployment. Assign a restore operator and retention schedule. Quiesce changes and back up the database, identities, schema, approval/audit records and registered object bytes together. Keep the digest manifest and its authenticated checksum separately protected. The media backup tool relies on destination encryption and does not encrypt files itself. A hosted backup was not created or verified in this review.
3. **Recovery rehearsal:** restore matching database objects, identities, rows and policies to a disposable target, then restore immutable original and derivative bytes from the corresponding snapshot. Verify hashes, private preview, approved public reads, and denial for archived/withdrawn media. The supplied byte-restore command is loopback-only. Prompt 11B tested byte and metadata recovery locally.
4. **Business enablement:** separately authorize the placeholder seed, designate an independent SUPER_ADMIN reviewer and acceptable rights evidence, and select the upload host/proxy. Before enabling editing, verify the hosted ledger, function owners/ACLs, RLS, private bucket flag, actual media access and public catalogue. Existing photographs still require documented commercial clearance.

This milestone produced this report only. The staging queries and preview applied no application migration, seeded no records and created no bucket.

**READY FOR STAGING APPROVAL**
