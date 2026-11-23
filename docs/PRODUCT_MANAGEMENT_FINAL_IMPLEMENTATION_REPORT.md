# Product and content management implementation

**23 November 2026 · Staging backend verified; hosted editor release pending.** The verified backend is VisionTech-Staging, reference `fszrsispjxunckknphaw`. Its ten migrations remain in place. This milestone made no schema changes.

## Delivered

- Added a staging entry point that uses the existing Node authentication, API handlers, database roles and product editor. It serves the packaged public files and proxies no requests to production. A project guard rejects a different Supabase origin. The product management page and its private product endpoints default to disabled.
- Packaged the site and Python/Pillow decoder in a non-root Linux container. Added a single-instance Render Blueprint with manual deployment, health checks and server-side secret placeholders.
- The service editor now includes missing source-defined services as private drafts. A manager can make the first explicit save through the existing RPC. With zero service rows, merely opening the editor publishes nothing. The catalogue editor previews attached images through the authenticated preview endpoint and provides a longer upload timeout and readable file errors.
- Added a restic backup job, an attachment-order and visibility manifest, a recovery verifier and daily/monthly Linux timers. Existing registry export retains the original and processed bytes, digests and review metadata. The remote backup account remains unprovisioned.
- Verified the workflow with disposable staging identities and original synthetic artwork. All 19 business records were preserved, including their update timestamps. All 42 archived originals matched their documented SHA-256.

## Management surface

| Actor | Available operations |
| --- | --- |
| Anonymous | Read published products and eligible images through the public API. |
| Active STAFF | Product management is denied by the private API and database write controls. |
| Active ADMIN | Create, edit, preview, publish, archive and restore products. Manage supported service descriptions, specifications, SEO, uploads, galleries and image order. |
| Active SUPER_ADMIN | Manager operations, contact settings and independent media review. Self-approval is prohibited. |

The editor supports model/name search, category/subcategory, visibility and resolution filters, sorting and ten-row pages. Products retain immutable model identity and optimistic edit versions. Public catalogue reads currently batch at the server and return the published collection to the client. The API remains suitable for the 19-row staging catalogue; this run did not benchmark large catalogues.

Public routes are `GET /api/public/products`, `/api/public/product-images/:id`, `/api/public/services` and `/api/public/contact-settings`. Product management uses `GET/POST /api/admin/products`, `PATCH /api/admin/products/:id`, `POST /api/admin/products/images`, private `GET /api/admin/products/images/:id` and `POST /api/admin/products/images/:id/review`. Services use `GET /api/admin/services` and `PATCH /api/admin/services/:id`. Settings use `GET/PATCH /api/admin/settings`. Login and session checks use the existing Auth endpoints.

Homepage hero, About and footer copy remain source-managed. The existing schema offers no structured editing contract for those sections. Service descriptions and the supported business-contact settings are the editable content surfaces. No new contact information or business claims were published.

## Files changed

| Location | Files |
| --- | --- |
| API and frontend | `services/admin-api.mjs`, `services/staging-host.mjs`, `js/admin/product-management.js` |
| deploy/staging | `Dockerfile`, `Dockerfile.dockerignore`, `render.yaml`, `backup.sh`, `backup-metadata.mjs`, `verify-snapshot.mjs`, `visiontech-media@.service`, `visiontech-media-backup.timer`, `visiontech-media-restore-check.timer` |
| docs | This report, the final test, hosting and backup reports, the rights workflow and the completion checklist. |

The production website, production DNS, hosted Auth/email settings, existing licensing decisions and remote Git history were outside this release. [Acceptance checklist](PROMPT_11_COMPLETION_CHECKLIST.md)
