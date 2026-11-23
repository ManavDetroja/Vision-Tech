# Prompt 11 — Product and content management

The existing Products and Services pages now have labelled editors. ADMIN and SUPER_ADMIN can maintain the shared catalogue through the Node API. STAFF and anonymous requests are denied at the management boundary. Public pages read published rows through the existing public endpoints. The migration was exercised on disposable local Supabase. Hosted rollout requires approval.

## Admin workflows

- Search names and exact or partial model codes. Combine category, subcategory, resolution and visibility filters. Sort by model, name, category or newest record. The browser paginates ten rows at a time.
- Preview records, create drafts, edit, publish, archive and restore. Existing model codes and record IDs are immutable in the editor. A stale product save returns HTTP 409 and requires reloading the current record. Archiving preserves historical enquiry model references.
- Edit name, description, brand, technical fields, features, source evidence, SEO title/description, gallery order and featured status. Featured records sort first in the default public catalogue. Empty fields are supported. New specification values and features require an administrator-supplied official source URL. The administrator must verify the source actually supports each claim.
- Select categories from the existing six-category hierarchy. Administrators can reclassify a product. Adding taxonomy definitions remains a coordinated code and database change.
- Edit title, summary, description, topics and visibility of the existing services. Existing service links, category mappings and enquiry identifiers are preserved. Service saves use the existing last-write-wins RPC. Homepage and About copy remain editorial files. Contact publication uses the existing SUPER_ADMIN settings.

## Photographs

All 19 legacy records have a main photograph. All 40 distinct referenced gallery files decoded locally. Every record still carries its earlier pending commercial-permission status and owner-directed display decision. Filesystem validation is evidence of readability only. See the existing product image processing report for provenance.

Administrators can preview, detach, select a primary photograph and reattach bundled photographs for the same model. New uploads require affirmation of both exact model identity and commercial rights. The backend accepts single-frame JPEG, PNG and WebP up to 4 MiB, decodes and re-encodes them, strips metadata and stores a content-addressed JPEG. Removing a gallery entry preserves its file. Draft uploads are static assets and must be suitable for public disclosure even before the model is published.

## API and deployment

| Method and path | Purpose |
| --- | --- |
| GET /api/admin/products | Manager catalogue, including archived rows and bundled model image choices |
| POST /api/admin/products | Create a draft or a published product |
| PATCH /api/admin/products/{id} | Edit, publish, archive or restore an existing product |
| POST /api/admin/products/images | Validate and store an approved image |
| GET, PATCH /api/admin/services (PATCH includes /{id}) | List or edit service content |
| GET /api/public/products and /api/public/services | Fetch published records anonymously |

The host must serve the static web root and route /api to the Node service. For uploads, provide Python with Pillow and a durable writable directory at assets/images/products/managed shared by the API and the web server. Set VISIONTECH_PYTHON if the correct interpreter is outside PATH. Include managed files in backups. An abandoned upload can leave an unattached image. The system has no automatic garbage collection. The local loopback Live Server preview uses the bundled snapshot when there is no API route. Hosted pages need a functioning publishing API.

Before enabling hosted editing, review the migration preflight, approve the migration separately, verify the published inventory and bootstrap missing records if necessary. The seed now inserts missing baseline records and leaves edits and visibility choices intact. Admin filtering and pagination operate in browser memory, which is suitable for the current catalogue.

## Files

- Admin interface and styles — js/admin/app.js, js/admin/product-management.js, css/admin.css.
- Public catalogue, details and service synchronization — js/data/products.js, js/data/public-content.js, js/features/catalogue.js, js/features/product-details.js, js/features/services.js.
- Backend, uploads and bootstrap — services/admin-api.mjs, services/api/product-management.mjs, services/api/product-photo.py, services/api/supabase.mjs, services/seed-admin-data.mjs.
- Data integrity and tests — supabase/migrations/20261122000300_product_editor.sql, services/tests/product-management.test.mjs.
- Companion documents — PRODUCT_CONTENT_SCHEMA.md, PRODUCT_MANAGEMENT_TEST_REPORT.md, PRODUCT_MANAGEMENT_MIGRATION_PREFLIGHT.md in docs/.
