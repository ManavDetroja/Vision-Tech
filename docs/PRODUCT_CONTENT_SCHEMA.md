# Catalogue and service data

| Location | Fields and contract |
| --- | --- |
| public.products | id and model identify the same product throughout its life. category_id, record, is_visible, created_at, updated_at and updated_by support the admin interface. |
| products.record | Existing model-specific JSON is preserved when editing. The save RPC sets id and categoryId consistently. Mutable fields include name, brand, description, subcategory, resolutionMp, features, specifications, featured, seoTitle and seoDescription. Channel count uses the existing channels specification. |
| Field evidence | specificationEvidence maps specification names to status and sourceUrl. Existing evidence for an unchanged value is retained. Changed specifications require a CP PLUS source. Existing verification metadata is retained except that changing resolution clears its prior verified-field flag. |
| Images | imagePath is the first selected photograph. galleryPaths lists photographs in display order. The existing permission, display approval and model-match flags govern public rendering. New normalized files use assets/images/products/managed/{MODEL}/{sha256}.jpg. |
| public.service_content | Existing id, record, is_visible, updated_at and updated_by. Only title, summary, description and capabilities are edited. Number and categoryIds continue to support public navigation. |
| public.admin_activity | Product saves add the acting user, action and product ID in the same transaction. |
| public.enquiries | Historical product_model is preserved when a product is edited or archived. |

## Category and identity rules

| Category ID | Permitted subcategories |
| --- | --- |
| ip-cameras | Dome Cameras, Bullet Cameras |
| wi-fi-cameras | PT Cameras |
| 4g-cameras | Dome Cameras, Bullet Cameras, PT Cameras |
| solar-products | Solar Panel Kits |
| nvr | None |
| poe-switches | None |

Subcategory can be empty. Product IDs for new models are lowercase model codes. Existing records retain their original IDs. The bootstrap source is js/data/products.json with 19 active baseline entries. The management API rejects CP-Z42Q, CP-UNC-DA41L3C-Q2 and CP-DNW-HPU8G2-6-V3. The proposed database constraint prevents publication of those model codes, including through existing database write paths.

The application sends {model, record, isVisible} on creation and includes expected (the last updated_at value) on edit. PostgreSQL locks the row before comparing the expected timestamp. A conflicting save leaves the data intact. Public reads return only record JSON for published rows. API authorization, database execution privileges and the active-role function protect management writes. Browser storage is not a catalogue database.
