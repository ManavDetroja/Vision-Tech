# Staging product catalogue seed execution

**Completed on 23 November 2026.** The approved product-only seed added 19 visible products to VisionTech-Staging (`fszrsispjxunckknphaw`). The starting inventory was empty.

## Pre-execution checks

At 03:39:54 IST the read-only CLI session identified the approved project by name and reference. Both local link files and the exact seed environment URL matched. The CLI displayed the default branch label `production` within this staging project. The server-side seed credential was present.

The remote ledger contained exactly these versions, in order:

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

Products, enquiries, media registry rows, published media and Storage objects all counted zero. The product-media bucket was private. Product RLS, direct client write restrictions, service-role INSERT, six approved product/media function fingerprints and the public projection matched the preflight.

| Input | Verified SHA-256 |
| --- | --- |
| js/data/products.json | `4b5d36cedaa7020559032293f30668187d22963bd2e9e6d4c10d9dfd464126fd` |
| services/seed-products.mjs | `43452368bd1a3a5c4c6031cb6d69bad576491597ce2168fadc2c3c496b2ed18c` |
| services/catalogue-seed.mjs | `b253ef300dce7dab5b68bc561ab05bf2138b160227e52e2698a6a8046f2b92c2` |
| js/data/categories.js | `e3e09f93046132109a74f3c4ff0213b5c371a6338f4614127db0e3b56f1fc0e8` |

## Execution

The same target and local hash checks passed again in the executing shell. From the project root, the following command ran once:

```powershell
node --env-file=.env services/seed-products.mjs --staging-fszrsispjxunckknphaw
```

Exit code: **0**. Output:

```text
Checked 19 baseline products. Existing rows retain their values.
```

The reviewed entry point sends one product insert batch and ignores primary-key conflicts. The independent before/after counts and complete record comparison establish 19 inserts, zero pre-existing products to update and zero deletions. The run included no migration, editor activation, media upload, settings change or GitHub push.

[Approved preflight](PRODUCT_CATALOGUE_STAGING_SEED_PREFLIGHT.md) · [Independent verification](PRODUCT_CATALOGUE_STAGING_SEED_VERIFICATION_REPORT.md)
