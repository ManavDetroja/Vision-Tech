# Product image processing report

Verified locally on 2026-11-15. Scope: product catalogue only; no deployment, database migration, authentication change, or real enquiry submission.

30 existing transparent cutouts were reused without processing. 10 verified opaque originals received separate transparent PNG derivatives. Two unconfirmed images remain untouched and unpublished. All 42 original hashes are unchanged and all 52 image files decode successfully.

## Method and safeguards

The available Pillow implementation removes only near-white pixels connected to the exterior: minimum RGB channel >= 250 and channel spread <= 3. Interior white product surfaces are retained. It crops to the resulting alpha bounds with 6% / minimum 12 px breathing room and does not resample, upscale, sharpen, synthesize, or change product proportions. This is local background masking, not AI segmentation. No new dependencies or model weights were installed.

All ten original/processed pairs were reviewed side by side. Product bodies, antennas, lens areas, brackets and connectors remain visible. Fine JPEG fringes and original shadows are retained rather than aggressively erasing pale product edges. No extra white outline was added because it would obscure already light-colored products. The website supplies a subtle card shadow.

## Original-to-output mapping

| Model | Preserved original | Separate processed PNG | Original pixels | Output pixels | Exterior pixels cleared |
| --- | --- | --- | --- | --- | --- |
| EZ-R33T | `assets/images/products/4G_Cameras/Bullet/EZ-R33T/EZ-R33T_01.jpg` | `assets/images/products/processed/4g-cameras/EZ-R33T.png` | [400, 520] | [418, 393] | 144850 |
| EZ-M32T | `assets/images/products/4G_Cameras/Dome/EZ-M32T/EZ-M32T_01.png` | `assets/images/products/processed/4g-cameras/EZ-M32T.png` | [400, 520] | [398, 428] | 95984 |
| EZ-S35T | `assets/images/products/4G_Cameras/PT/EZ-S35T/EZ-S35T_01.png` | `assets/images/products/processed/4g-cameras/EZ-S35T.png` | [400, 520] | [404, 554] | 84902 |
| CP-UNC-TA61L3C-LQ | `assets/images/products/IP_Cameras/Bullet/CP-UNC-TA61L3C-LQ/CP-UNC-TA61L3C-LQ_01.png` | `assets/images/products/processed/ip-cameras/CP-UNC-TA61L3C-LQ.png` | [400, 520] | [414, 249] | 155661 |
| CP-UNC-DA61L3C-LQ | `assets/images/products/IP_Cameras/Dome/CP-UNC-DA61L3C-LQ/CP-UNC-DA61L3C-LQ_01.jpg` | `assets/images/products/processed/ip-cameras/CP-UNC-DA61L3C-LQ.png` | [400, 520] | [418, 382] | 115748 |
| CP-UNR-104F1 | `assets/images/products/NVR/CP-UNR-104F1/CP-UNR-104F1_01.jpg` | `assets/images/products/processed/nvr/CP-UNR-104F1.png` | [400, 520] | [445, 123] | 181594 |
| CP-UNR-4K4322-V4 | `assets/images/products/NVR/CP-UNR-4K4322-V4/CP-UNR-4K4322-V4_01.jpg` | `assets/images/products/processed/nvr/CP-UNR-4K4322-V4.png` | [400, 520] | [443, 191] | 167204 |
| CP-ANW-HP4H2-N65 | `assets/images/products/POE_Switches/CP-ANW-HP4H2-N65/CP-ANW-HP4H2-N65_01.jpg` | `assets/images/products/processed/poe-switches/CP-ANW-HP4H2-N65.png` | [400, 520] | [391, 144] | 173206 |
| CP-ANW-HPU8H2-N12 | `assets/images/products/POE_Switches/CP-ANW-HPU8H2-N12/CP-ANW-HPU8H2-N12_01.jpg` | `assets/images/products/processed/poe-switches/CP-ANW-HPU8H2-N12.png` | [400, 520] | [444, 165] | 162775 |
| CP-SL06K | `assets/images/products/Solar_Products/CP-SL06K/CP-SL06K_01.png` | `assets/images/products/processed/solar-products/CP-SL06K.png` | [400, 520] | [441, 582] | 162997 |

## All 22 model decisions

| Model | Originals used without processing | Processed images used | Unresolved |
| --- | --- | --- | --- |
| CP-UNC-DA21L3C-Q | 6 | 0 | None for existing mapped files |
| CP-UNC-DA21L3B-LQ | 7 | 0 | None for existing mapped files |
| CP-UNC-DA41L3C-Q2 | 0 | 0 | Missing local photograph |
| CP-UNC-DA61L3C-LQ | 0 | 1 | None for existing mapped files |
| CP-UNC-TA21L3C-Q | 6 | 0 | None for existing mapped files |
| CP-UNC-TA21L3B-LQ | 6 | 0 | None for existing mapped files |
| CP-UNC-TA41L3C-D-Q2 | 1 | 0 | None for existing mapped files |
| CP-UNC-TA61L3C-LQ | 0 | 1 | None for existing mapped files |
| CP-E21Q | 1 | 0 | None for existing mapped files |
| CP-E31Q | 1 | 0 | None for existing mapped files |
| CP-Z42Q | 0 | 0 | Identity confirmation required; owner declined publication |
| EZ-M32T | 0 | 1 | None for existing mapped files |
| EZ-R33T | 0 | 1 | None for existing mapped files |
| EZ-S35T | 0 | 1 | None for existing mapped files |
| CP-SL06K | 0 | 1 | None for existing mapped files |
| CP-UNR-104F1 | 0 | 1 | None for existing mapped files |
| CP-UNR-4K2081-V4 | 1 | 0 | None for existing mapped files |
| CP-UNR-4K2162-V3 | 1 | 0 | None for existing mapped files |
| CP-UNR-4K4322-V4 | 0 | 1 | None for existing mapped files |
| CP-ANW-HP4H2-N65 | 0 | 1 | None for existing mapped files |
| CP-DNW-HPU8G2-6-V3 | 0 | 0 | Identity confirmation required; owner declined publication |
| CP-ANW-HPU8H2-N12 | 0 | 1 | None for existing mapped files |

## Reusable local tool

`scripts/process-catalogue-images.py` accepts explicit source and output paths. It refuses an existing output, a source/output collision, and already-transparent input. Review every generated result before adding it to product data. Existing derivatives should not be regenerated merely to rerun the milestone.

The established category folders remain the source archive. Only processed/ was added. No redundant thumbnails, WebP copies or previews were generated: the supplied photos are already modest in size and card images use lazy loading. Small original images cannot provide additional optical detail without better source assets.

## Integration and limitations

19 models use 40 verified local gallery files: 30 original transparent images plus 10 derivatives. Main cards, detail galleries and related cards share the same product paths. Original paths, dimensions, mapping evidence and source URLs remain in imageAssets. Rights are explicitly PERMISSION_PENDING; owner-directed local display is not a commercial reuse license. No production deployment occurred.

See [image inventory](PRODUCT_IMAGE_INVENTORY.md) for every original and hash, and [QA](PRODUCT_QA_REPORT.md) for browser decoding, selection, fallbacks and clipping checks.
