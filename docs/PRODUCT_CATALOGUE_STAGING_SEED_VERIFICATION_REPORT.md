# Staging product catalogue seed verification

**Passed on 23 November 2026.** Two independent reads verified the outcome on VisionTech-Staging (`fszrsispjxunckknphaw`).

## Stored and public records

The first check used the staging public API key with no signed-in user. Both REST reads, `products` and `published_product_media`, returned HTTP 200. The test compared the complete model set and deep-compared every returned row with the reviewed source after the seed's image-field exclusions. This covered the relational ID, model, category ID, visibility and complete JSON record, including subcategory, specifications and evidence. The same public image component used by the website returned placeholder markup and no image tag for each model.

| Category | Verified exact models | Full record and placeholder checks |
| --- | --- | ---: |
| IP Cameras / Dome | CP-UNC-DA21L3C-Q, CP-UNC-DA21L3B-LQ, CP-UNC-DA61L3C-LQ | 3/3 |
| IP Cameras / Bullet | CP-UNC-TA21L3C-Q, CP-UNC-TA21L3B-LQ, CP-UNC-TA41L3C-D-Q2, CP-UNC-TA61L3C-LQ | 4/4 |
| Wi-Fi Cameras / PT | CP-E21Q, CP-E31Q | 2/2 |
| 4G Cameras / Dome, Bullet, PT respectively | EZ-M32T, EZ-R33T, EZ-S35T | 3/3 |
| Solar Products / Solar Panel Kits | CP-SL06K | 1/1 |
| NVR | CP-UNR-104F1, CP-UNR-4K2081-V4, CP-UNR-4K2162-V3, CP-UNR-4K4322-V4 | 4/4 |
| PoE Switches | CP-ANW-HP4H2-N65, CP-ANW-HPU8H2-N12 | 2/2 |

A separate read-only SQL session at **03:40:37 IST** inspected all stored rows, including anything anonymous access might hide.

| Database check | Actual |
| --- | ---: |
| Products / distinct models / visible products | 19 / 19 / 19 |
| Retired models | 0 |
| Product records with image, gallery, media ID or published media fields | 0 |
| Media registry rows / approved media rows / published media rows | 0 / 0 / 0 |
| Storage objects / enquiries | 0 / 0 |
| Applied migrations | 10 |

Both checks excluded `CP-Z42Q`, `CP-UNC-DA41L3C-Q2` and `CP-DNW-HPU8G2-6-V3`.

## Write and publication restrictions

- The live ACL check showed neither anon nor authenticated has direct INSERT or UPDATE at table or column level, or table DELETE on products. Anon also lacks EXECUTE on the three product write RPCs. Authenticated callers may invoke those RPCs, whose reviewed bodies enforce ADMIN/SUPER_ADMIN product management. The live role helper reads an active profile for the signed-in user. All six reviewed function fingerprints matched, and both record guards were enabled.
- RLS was enabled on products, the media registry and Storage objects. The products read policy exposes visible products to anonymous users. The media publication view requires a visible product, an approved matching media row and an attachment to that product. The bucket was private. The anonymous media read returned an empty array.
- No active STAFF account existed at verification time. This run checked live grants, function bodies, role lookup and predicates. The previous staging rollback test exercised actual STAFF and anonymous write denial, hidden product denial, withdrawal of approval and archival. This run created no identity or negative-test fixture. [Role-based test evidence](PRODUCT_MANAGEMENT_STAGING_VERIFICATION_REPORT.md)

The placeholder check exercised the renderer against live anonymous data. It did not exercise a hosted browser session. The specification comparison establishes agreement with the reviewed source catalogue.

[Seed execution and input hashes](PRODUCT_CATALOGUE_STAGING_SEED_EXECUTION_REPORT.md)
