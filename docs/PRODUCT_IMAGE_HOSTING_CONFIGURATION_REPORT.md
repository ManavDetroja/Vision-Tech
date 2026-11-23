# Staging product image hosting verification

**23 November 2026 — hosted editor activation blocked.** VisionTech-Staging has a working private byte store. The owner confirmed selection of the staging HTTPS upload host and independent encrypted backup destination is pending. The API ran on the verification workstation for these checks. There is no verified hosted API origin or active staging manager.

## Configuration and hosting contract

| Component | State and requirement |
| --- | --- |
| Supabase | Local CLI link and remote identity matched VisionTech-Staging, `fszrsispjxunckknphaw`. Both live SQL snapshots showed ten migrations and private bucket `visiontech-product-media`, restricted to JPEG, PNG and WebP, with an 8,388,608-byte object limit. |
| Upload service | The Node API handles `POST /api/admin/products/images` behind session, role and origin checks. Keep one long-lived process for in-memory sessions. The current listener binds to loopback. Provision a same-host HTTPS reverse proxy that can reach it and forwards `/api/`. A host requiring an externally bound application port needs a compatible ingress arrangement. |
| Upload path | Allow a 5,700,000-byte JSON request envelope and binary input up to 4 MiB. Support outbound HTTPS to this staging project, Node fetch, Python with Pillow, subprocesses and sufficient memory/time for decoding and multiple sequential Storage calls. The processor and each Storage request have 12-second timeouts. Verify the full path at the limit on the chosen host. |
| Configuration | Set server-side `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, exact HTTPS `APP_ORIGIN` and a random `RATE_LIMIT_HASH_SECRET` of at least 32 characters. Set `NODE_ENV=production`, configure `ADMIN_API_PORT` for the proxy, and set `TRUST_PROXY` only with controlled forwarding headers. Set `VISIONTECH_PYTHON` if the isolated Python executable is outside PATH. The workstation has a loopback application origin and Pillow 13.0.0. These observations do not establish any hosted configuration. |
| Persistence and static files | Original and derivative bytes live in Supabase Storage. Serve only the output of the project's static packager. Keep the source checkout, archival photographs, environment files and private previews outside the public static root. No persistent application filesystem is required for uploads. |
| References and replacement | The registry uses a stable UUID, model and digests. New content receives a different content-addressed key. An ordinary edit can replace or detach a model-matching reference. A retry reuses existing bytes only after hashing them. The application exposes no hard-delete endpoint. Private unregistered objects can survive an interrupted upload and need separate inventory. |
| Publication | Manager preview requires authorization. The public image GET checks the published-media view on every request and verifies the JPEG digest before serving it with private/no-store caching. The view requires an approved registry row, a visible product and an attachment to that product. |

## Test results and boundaries

One programmatically created 12 × 8 solid-colour PNG and its normalized JPEG were used exclusively under a unique disposable Storage prefix. Neither was linked to a catalogue product. No image-rights approval was granted.

| Check | Result |
| --- | --- |
| Validation | The repository decoder accepted the PNG, produced a 12 × 8 JPEG, and rejected both a mislabeled PNG and truncated input. A hosted ingress size test remains pending. |
| Authenticated Storage transport | The staging backend credential created both objects over HTTPS (200). Separate authenticated GETs returned the original bytes and the processed bytes with matching digests. This exercised workstation-to-staging connectivity. |
| Unauthorized upload and reads | The actual API handler on loopback returned 401 for an upload without a session. Staging Storage returned 400 for an anonymous new-object upload and for anonymous reads of each existing object at both private and public URL variants. The anonymous upload left no object. |
| Replacement protection and cleanup | A second create-only upload at each occupied key returned 400. Both existing objects retained their hashes. Exact-key deletion of the disposable objects succeeded and subsequent authenticated reads confirmed absence. |
| Public and private application delivery | The public image handler returned 404 for an unlisted UUID. No active manager or registered media existed. A manager upload and preview, replacement through the editor, and transitions involving unpublished or withdrawn media were not exercised on a hosted API. The previous staging rollback test demonstrated hidden-product and unapproved-media denial and withdrawal in SQL. No public success-to-withdrawal sequence was attempted under the prohibition on granting rights. |
| Catalogue during the test | With both private files present, the staging-backed public API returned HTTP 200. All 19 records matched the reviewed catalogue projection in full. All had empty published-media lists and rendered placeholders with no image element. |
| Independent final SQL | At 03:46:28 IST there were 19 products, all visible, zero retired models, zero registry or published-media rows, zero Storage objects, zero users/profiles and zero admin activity rows. These matched the pre-test inventory. Excluded models: CP-Z42Q, CP-UNC-DA41L3C-Q2 and CP-DNW-HPU8G2-6-V3. |

## Before enabling the editor

1. Owner selects the staging API host and HTTPS origin, configures server-side secrets and confirms the proxy, runtime, memory, upload limits and Storage connectivity from that host.
2. Arrange an authorized staging manager test session. From the chosen host, verify a real upload, authenticated preview, duplicate handling, replacement/detachment, anonymous denial and cleanup. A previously published-to-withdrawn transition needs an independently cleared control or an isolated test environment where that transition is permitted.
3. Select and exercise the independent backup destination, key recovery and retention plan. Keep the editor disabled until the hosted tests and recovery drill pass.

[Backup and recovery results](PRODUCT_IMAGE_BACKUP_RECOVERY_TEST_REPORT.md) · [Implementation](PRODUCT_IMAGE_STORAGE_IMPLEMENTATION_REPORT.md) · [Prior staging security tests](PRODUCT_MANAGEMENT_STAGING_VERIFICATION_REPORT.md) · [Seed verification](PRODUCT_CATALOGUE_STAGING_SEED_VERIFICATION_REPORT.md)
