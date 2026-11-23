# Product management staging preflight

**23 November 2026 · READY WITH CONDITIONS.** The database candidate is compatible with the observed staging baseline and is eligible for a separate schema-only approval. Applying it would leave staging with zero products. Opening the hosted editor and publishing the catalogue have additional gates below.

## Identity and migration evidence

Local link metadata and the remote CLI banner independently identified **VisionTech-Staging**, reference `fszrsispjxunckknphaw`. The CLI labels this project's default branch `production`, as previously recorded in the notification deployment report. Every remote command explicitly targeted this staging reference.

| Check | Current evidence |
| --- | --- |
| Candidate | `20261122000300_product_editor.sql`; SHA-256 `31EF51010C7A573BE825633B37A0A8498A1109C5C53E2F6296790AA7D7FF5D54` |
| Exact SQL | Compared the entire file against the SQL block in the previous preflight, normalizing line endings and trailing whitespace. Text matched; the independent byte-level hash also matched. [SQL file](../supabase/migrations/20261122000300_product_editor.sql) · [Reviewed SQL block](PRODUCT_MANAGEMENT_MIGRATION_PREFLIGHT.md#exact-reviewed-sql) |
| Remote ledger, in order | `202611120001`, `202611120002`, `20261112170000`, `20261116130000`, `20261116130100`, `20261122000100`, `20261122000150`, `20261122000200`. All eight have local files. Ledger versions and relevant live dependencies were checked; ledger membership is not a byte comparison of historical SQL. |
| Object and data baseline | Candidate function and constraint absent. Products 0, published 0, retired rows subject to the update 0, enquiries containing a nonempty product model 0, Storage buckets 0. The expected products relation, admin_activity relation, current_admin_role() and auth.uid() exist. |
| After the preview | A second read-only catalog query still returned eight ledger entries, zero products and zero matching constraints. |

The installed Supabase CLI was **3.1.0**. The following preview exited **0**. Vault synchronization was explicitly skipped. The CLI also announced an optional version update.

```text
supabase db push --remote=fszrsispjxunckknphaw --dry-run --skip-vault --workdir "C:\Vision Tech" --output-format text

Target: project VisionTech-Staging (fszrsispjxunckknphaw) · production
Initialising login role...
DRY RUN: migrations will *not* be pushed to the database.
Would push these migrations:
 • 20261122000300_product_editor.sql
Finished supabase db push.
```

The preview establishes ordering. Execution evidence comes from the previous disposable nine-migration run. The remote review used catalog SELECTs and did not exercise write paths or create fixtures.

## Exact database effects and access

1. The conditional UPDATE archives visible rows whose trimmed, case-normalized model is one of the three exclusions. The CHECK `products_excluded_models_hidden` prevents publishing them through any normal writer. This changes behavior intentionally, preserves historical rows, and requires a table lock for constraint validation. There are no new tables, columns, indexes, triggers or policies. It is an additive schema change with a scoped data update.
2. `public.admin_save_catalogue_product(text,jsonb,text,boolean,timestamptz) RETURNS public.products` accepts a new model or edits an existing row. New IDs are derived from the model. Edits preserve model and ID; category changes synchronize the column and JSON. A row lock and expected timestamp protect updates through this function. Visibility toggles implement publish, archive and restore. It writes actor and product ID to admin_activity in the same transaction. Old RPC signatures remain available. Replaying this SQL outside migration tracking is not idempotent.
3. The new function uses SECURITY DEFINER, a fixed `pg_catalog, public, auth, pg_temp` search path and an active-role guard. SQL revokes EXECUTE from PUBLIC and anon and grants it to authenticated. The creating database role will own it; the file specifies no ALTER OWNER. Its hosted owner and effective ACL can only be confirmed after deployment. Both live legacy write RPCs are owned by postgres, are security definers with the same fixed path, and grant authenticated execution while denying anon. Neither anon nor authenticated has CREATE on public.
4. The deployed helper reads role only from the caller's ACTIVE profile using auth.uid(). Active ADMIN and SUPER_ADMIN can manage all product rows. STAFF and disabled users are denied management by the API and the RPC guard. Public products remain readable anonymously. Live RLS is enabled, with a SELECT policy for visible rows or an active manager. Neither client role has table INSERT/UPDATE/DELETE/TRUNCATE or column-level INSERT/UPDATE. The existing server uses the caller's token for these mutations and checks management role and request origin before dispatch. Service-role credentials remain privileged and server-side.
5. Public API queries filter is_visible and return record JSON. Direct table SELECT is broader in **columns** on permitted rows; publication makes the whole row accessible under existing grants, including fields such as updated_by. Keep internal evidence, staff details and private review material out of public record JSON. RLS protects archived database rows. It cannot retract copies already distributed in bundled JSON, static image files or caches.

### Integrity boundary requiring an owner decision

The editor API validates input types, source URLs and model-scoped image paths. The new RPC accepts a wider JSON patch from authenticated **managers**. Its database checks cover identity and taxonomy, but do not enforce the API's editable-field allowlist, image provenance or field-level evidence. The two existing manager RPCs also remain callable directly; legacy edits do not require an expected timestamp. These are manager-level integrity gaps. The read-only review found no new write permission for anonymous users or STAFF.

Before opening hosted management, explicitly decide whether all managers are trusted to set verification and rights metadata directly. For server-enforced publication controls, protect those fields in the database, apply consistent validation to all supported write RPCs, and retire or restrict legacy paths after checking callers. Require versioning on every supported edit path. Test direct RPC role restrictions, stale saves and protection of approval metadata against a disposable database before presenting revised SQL for approval.

## Catalogue and enquiry verification

A fresh Edge run loaded the actual local HTML, JavaScript and assets using an intercepted loopback preview. It matched all 19 catalogue cards to the baseline, verified the selected gallery model and decoded the main photograph on **19/19** details, and followed the enquiry links to the correctly prefilled form on **19/19** models. Both enquiry links on each page pointed to the same model. The three retired routes all returned the product-not-found view. No enquiry was submitted. The hosted database currently cannot serve these 19 detail records.

| Category | Verified baseline model codes |
| --- | --- |
| IP Cameras · Dome | CP-UNC-DA21L3C-Q, CP-UNC-DA21L3B-LQ, CP-UNC-DA61L3C-LQ |
| IP Cameras · Bullet | CP-UNC-TA21L3C-Q, CP-UNC-TA21L3B-LQ, CP-UNC-TA41L3C-D-Q2, CP-UNC-TA61L3C-LQ |
| Wi-Fi Cameras · PT | CP-E21Q, CP-E31Q |
| 4G Cameras · Dome / Bullet / PT respectively | EZ-M32T, EZ-R33T, EZ-S35T |
| Solar Products · Solar Panel Kits | CP-SL06K |
| NVR | CP-UNR-104F1, CP-UNR-4K2081-V4, CP-UNR-4K2162-V3, CP-UNR-4K4322-V4 |
| PoE Switches | CP-ANW-HP4H2-N65, CP-ANW-HPU8H2-N12 |

CP-Z42Q, CP-UNC-DA41L3C-Q2 and CP-DNW-HPU8G2-6-V3 are excluded. Existing enquiry product references are model text; archiving retains that identity. The seed checks 19 unique models and rejects the exclusions. Both table imports specify `on_conflict=id` and `resolution=ignore-duplicates`. Existing rows retain their admin edits and archive state. Missing baseline rows are inserted as **visible**, and missing service records are also inserted. The two imports are separate requests. A failure between them requires checking both inventories and retrying. Staging seeding requires its own decision, including how the photographs will be withheld pending permission.

Fresh local product-validation tests passed **8/8**. Prior disposable integration tests recorded manager create/publish/archive/restore, stale-save rejection, anonymous/STAFF denials, disabled login denial, enquiry preservation across archive/reseed and 60 passing pgTAP assertions. These are local results. [Prompt 11 test report](PRODUCT_MANAGEMENT_TEST_REPORT.md)

## Recovery and approval conditions

- **Before a schema-only approval:** repeat the target, digest, single-pending-version and row-count checks if the baseline changes. Capture the prior visibility and timestamp of any newly affected rows. Select a low-contention window. Review the available staging recovery point before execution. This review did not create a backup or test a restore. A failed transaction can roll back; reverting a committed migration requires a reviewed forward correction. Preserve intervening admin edits and maintain the retired-product block.
- **After any separately approved schema change:** check ledger, constraint definition/validation, exact function body, owner, search path and effective ACLs, then verify published-row RLS. Stop on a mismatch. Check the editor against disposable records before enabling business use.
- **Before enabling uploads or public content:** implement a durable storage path, validate draft isolation, decide manager write controls, and secure asset rights or use placeholders. Only then approve catalogue initialization and compare all 19 published rows and routes against the baseline. [Image storage and licensing review](PRODUCT_IMAGE_STORAGE_ARCHITECTURE_REVIEW.md)

**READY WITH CONDITIONS**
