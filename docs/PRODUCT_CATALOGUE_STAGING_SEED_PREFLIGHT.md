# VisionTech staging catalogue seed preflight

**Decision on 23 November 2026: READY FOR SEED APPROVAL.** The current staging catalogue is empty. The product-only seed would add 19 visible product records with placeholders. The live preview used a SELECT in a read-only session. The local payload preview intercepted the request in memory. Neither preview inserted products.

## Expected changes

| Measure | Count |
| --- | ---: |
| Current staging products | 0 |
| Intended products to insert | 19 |
| Existing products to preserve, including hidden or archived | 0 |
| Products to update or delete | 0 |
| Expected total products / visible products after approval and execution | 19 / 19 |
| Image attachments, image approvals and uploads to add | 0 |
| Retired models present now / proposed for insertion | 0 / 0 |

### Model-by-model preview

| Exact model | Existing category | Existing subcategory | Proposed action |
| --- | --- | --- | --- |
| CP-UNC-DA21L3C-Q | IP Cameras | Dome Cameras | Insert with placeholder |
| CP-UNC-DA21L3B-LQ | IP Cameras | Dome Cameras | Insert with placeholder |
| CP-UNC-DA61L3C-LQ | IP Cameras | Dome Cameras | Insert with placeholder |
| CP-UNC-TA21L3C-Q | IP Cameras | Bullet Cameras | Insert with placeholder |
| CP-UNC-TA21L3B-LQ | IP Cameras | Bullet Cameras | Insert with placeholder |
| CP-UNC-TA41L3C-D-Q2 | IP Cameras | Bullet Cameras | Insert with placeholder |
| CP-UNC-TA61L3C-LQ | IP Cameras | Bullet Cameras | Insert with placeholder |
| CP-E21Q | Wi-Fi Cameras | PT Cameras | Insert with placeholder |
| CP-E31Q | Wi-Fi Cameras | PT Cameras | Insert with placeholder |
| EZ-M32T | 4G Cameras | Dome Cameras | Insert with placeholder |
| EZ-R33T | 4G Cameras | Bullet Cameras | Insert with placeholder |
| EZ-S35T | 4G Cameras | PT Cameras | Insert with placeholder |
| CP-SL06K | Solar Products | Solar Panel Kits | Insert with placeholder |
| CP-UNR-104F1 | NVR | — | Insert with placeholder |
| CP-UNR-4K2081-V4 | NVR | — | Insert with placeholder |
| CP-UNR-4K2162-V3 | NVR | — | Insert with placeholder |
| CP-UNR-4K4322-V4 | NVR | — | Insert with placeholder |
| CP-ANW-HP4H2-N65 | PoE Switches | — | Insert with placeholder |
| CP-ANW-HPU8H2-N12 | PoE Switches | — | Insert with placeholder |

Excluded from both the source payload and the live catalogue: `CP-Z42Q`, `CP-UNC-DA41L3C-Q2`, `CP-DNW-HPU8G2-6-V3`. The database also has a constraint preventing visible records for these codes.

## Target and schema evidence

The local CLI link, the environment URL origin and the live CLI target matched VisionTech-Staging (`fszrsispjxunckknphaw`). A server seed credential was present. The CLI's `production` label denotes this staging project's default branch, as recorded in the [deployment report](PRODUCT_MANAGEMENT_STAGING_DEPLOYMENT_REPORT.md).

Supabase CLI 3.1.0 ran `db query --read-only --remote=fszrsispjxunckknphaw`. The database returned its observation time as **23 November 2026, 03:37:02 IST**. The ten ledger versions in ascending order were:

```text
202611120001
202611120002
20261112170000
20261116130000
20261116130100
20261122000100
20261122000150
20261122000200
20261122000300
20261123000100
```

The query compared the 19 intended model codes against both the lowercase product ID and the uppercase stored model. All 19 were missing. The independent total over all product rows was zero, including zero hidden rows. There are no current administrator-edited rows, conflicting identifiers or archive decisions to preserve. The same snapshot returned zero enquiries, zero media registry rows and zero published media rows.

The live target accepts the five seed fields: text primary key `id`, unique text `model`, text `category_id`, JSONB `record` and boolean `is_visible`. Constraints tie the JSON ID, model and category to their relational columns. The seed omits the timestamp and actor fields. The service role has INSERT on products. The product-only entry point has no writes to enquiries, services, media or Storage.

## Payload and repeat execution

A local preview replaced fetch before importing the seed helper and supplied a loopback URL and dummy credential. The helper produced exactly one request with 19 unique IDs. Each record matched the existing catalogue after removal of image/gallery fields and media attachments. All 19 retained the existing specification and evidence values, used the original model and taxonomy, and rendered the placeholder through the existing product image component. No approval fields appeared in the captured records. This checks faithful transfer of the catalogue; it does not establish new manufacturer claims or grant reuse rights.

The request targets `products?on_conflict=id` with `Prefer: resolution=ignore-duplicates,return=minimal`. A repeated ID skips the whole row, preserving administrator edits, visibility, archive state and attachments. The prior disposable database test archived and renamed a seeded product and verified both changes survived a second run. A unique-model conflict under a different ID would warrant investigation before proceeding. The original IDs and model strings used by detail and enquiry links are preserved. [Product-only seed and repeat-execution test](PRODUCT_CATALOGUE_SEED_PLAN.md)

| Reviewed input | SHA-256 |
| --- | --- |
| `js/data/products.json` | `4b5d36cedaa7020559032293f30668187d22963bd2e9e6d4c10d9dfd464126fd` |
| `services/seed-products.mjs` | `43452368bd1a3a5c4c6031cb6d69bad576491597ce2168fadc2c3c496b2ed18c` |
| `services/catalogue-seed.mjs` | `b253ef300dce7dab5b68bc561ab05bf2138b160227e52e2698a6a8046f2b92c2` |
| `js/data/categories.js` | `e3e09f93046132109a74f3c4ff0213b5c371a6338f4614127db0e3b56f1fc0e8` |

## Access and publication

- **Product management.** Staging has RLS enabled on products. Neither anon nor authenticated has direct INSERT or UPDATE privileges, even at column level, or table DELETE. Application writes use role-checked functions for active ADMIN and SUPER_ADMIN. The server-side service role is the separately privileged seed path.
- **Unpublished products.** The live products read policy requires visibility or an ADMIN/SUPER_ADMIN role. Earlier staging rollback tests demonstrated anonymous and STAFF create denial, authorized administrator edits and anonymous hidden-product denial.
- **Unapproved images.** The verified bucket is private. The live public media view requires an approved registry row, a visible matching product and that media ID attached to the product. All three predicates must hold. Earlier staging checks exercised approval, withdrawal and archival, including the independent SUPER_ADMIN rights decision.
- **Evidence boundary.** All six product/rights function body fingerprints matched the deployed verification report on this read-only pass. Role-changing or write fixtures were not rerun. No hosted editor session or live delivery request was needed for the seed preview. [Staging role and publication tests](PRODUCT_MANAGEMENT_STAGING_VERIFICATION_REPORT.md)

## Approval and execution boundary

No technical blocker surfaced in this snapshot. Actual insertion requires separate explicit approval. Immediately before an approved run, recheck the target, ledger, hashes and live ID/model inventory. If they differ, refresh the preview before inserting. Use only the standalone product seed described in the seed plan. Afterwards, verify the exact model set, visible count, placeholders and continued exclusion of the three retired codes. Keep editor activation and media publication separate from seed approval.

**READY FOR SEED APPROVAL**
