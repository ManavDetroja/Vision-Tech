# Prompt 11B — separate catalogue bootstrap

Run [seed-products.mjs](../services/seed-products.mjs) only after approval for the target and both migrations. The separate script reads the existing catalogue through [catalogue-seed.mjs](../services/catalogue-seed.mjs). The older combined bootstrap delegates product work to the same implementation and additionally initializes services. Use the product-only entry point for this milestone.

| Existing category | Exact baseline models |
| --- | --- |
| IP Cameras / Dome | CP-UNC-DA21L3C-Q, CP-UNC-DA21L3B-LQ, CP-UNC-DA61L3C-LQ |
| IP Cameras / Bullet | CP-UNC-TA21L3C-Q, CP-UNC-TA21L3B-LQ, CP-UNC-TA41L3C-D-Q2, CP-UNC-TA61L3C-LQ |
| Wi-Fi Cameras / PT | CP-E21Q, CP-E31Q |
| 4G Cameras / Dome, Bullet, PT respectively | EZ-M32T, EZ-R33T, EZ-S35T |
| Solar Products / Solar Panel Kits | CP-SL06K |
| NVR | CP-UNR-104F1, CP-UNR-4K2081-V4, CP-UNR-4K2162-V3, CP-UNR-4K4322-V4 |
| PoE Switches | CP-ANW-HP4H2-N65, CP-ANW-HPU8H2-N12 |

The script checks the exact model set, ID mapping and allowed taxonomy before sending a single insert batch. It uses unique ID conflicts with ignore-duplicates. Missing baseline records become visible with their existing technical information and placeholders. It removes legacy image fields and imports no photo approval, source bytes or gallery attachments. Existing rows retain their current name, specifications, visibility, timestamp and attachments. A conflicting model under another ID should be investigated, never overwritten. The three retired codes CP-Z42Q, CP-UNC-DA41L3C-Q2 and CP-DNW-HPU8G2-6-V3 are outside the allowlist. Historical enquiry model strings are untouched.

## Staging procedure for the owner

1. Confirm VisionTech-Staging, project reference fszrsispjxunckknphaw, the expected ledger and the available recovery point. Compare current product IDs/models/categories and capture the pre-existing visibility and versions. A row that an administrator intentionally archived must stay archived.
2. Use the backend environment with the staging URL and server secret. Check the URL hostname without printing credentials. Following separate seed approval, run from the project root:

   ```powershell
   node --env-file=.env services/seed-products.mjs --staging-fszrsispjxunckknphaw
   ```
3. Compare public results to the expected new entries plus the pre-existing visible set. Verify all new records display placeholders, all three retired models remain excluded, and existing records and enquiry references retain their pre-run values. Investigate any discrepancy before enabling hosted management. To withdraw newly introduced content, archive only identified added rows through an approved, version-checked edit.

The disposable local test seeded 19 products, archived and renamed an existing model, then reran the seed. The changed name, archive state and exact identities were preserved. A test of the standalone target guard rejected an unrelated hostname before submission. No staging seed was run.
