# Product and content management verification

Tests used the actual application modules, a disposable Supabase project named vt-p11-local and a loopback browser/API server. Verification covered the nine-migration schema through version 20261122000300. The local API harness used generated credentials, an empty email-provider configuration and a loopback target assertion. Hosted services were outside the test scope.

| Check | Observed result |
| --- | --- |
| Database installation | Local ledger showed all nine versions in order. Product RLS was enabled. anon lacked EXECUTE on the new save RPC. |
| Existing pgTAP suites | 21/21 RLS, 18/18 enquiry API security, 12/12 staff permissions and 9/9 notification delivery assertions passed. |
| Node regression suites | 48 passed, 0 failed, 0 skipped, including eight product validation cases. Run `node --test services/tests/*.test.mjs` with loopback sockets available. |
| Access control | Anonymous management GET and POST returned 401. STAFF GET, POST and image upload returned 403. Disabled fixture login returned 403. ADMIN created, edited and archived. SUPER_ADMIN published using its own session. |
| Catalogue lifecycle | Created an unpublished record, confirmed exclusion from public reads, published, archived and restored it. A save with an obsolete version returned 409. The published baseline model set matched all 19 expected records. |
| Excluded models | Creation of each of the three retired models returned 422. A public detail navigation to CP-Z42Q showed the not-found state. |
| Bootstrap and historical enquiries | Archived a seeded product with an existing synthetic enquiry, reran the bootstrap and confirmed it stayed hidden. Restoration preserved the original enquiry model. |
| Image upload | API accepted a valid PNG fixture and returned a content-addressed JPEG under its requested model. Missing rights affirmation, unsupported type, malformed bytes and a payload exceeding 4 MiB returned 422. STAFF upload was denied. The published fixture used the new path. |
| Product admin browser | Edge showed ten rows on page one and navigated to page two. Combined model search, IP category, dome subcategory, 4 MP, published visibility and newest-first sorting selected the expected fixture. Preview opened; Escape closed it; browser edit/save updated the public SEO title. The public meta description matched the saved value. |
| Responsive layout | Product list had no page-level horizontal overflow at 1440, 768 and 375 CSS pixels. No full assistive-technology audit was performed. |
| Public detail routes | Edge opened each of the 19 existing model URLs, matched its rendered gallery model and decoded its primary image. No uncaught JavaScript errors occurred in this run. |
| Gallery coverage | Pillow decoded every one of the 40 distinct referenced files. Main photographs were separately verified in Edge for all 19 products. Commercial permission remains pending for all 19 baseline records. |
| Service content | Authorized PATCH changed an existing summary. The public service endpoint returned it and Edge displayed it on the services page. |
| Public load errors and preview | Simulated HTTP 503 on the published product endpoint produced retry guidance on catalogue and details. Simulated absent API route (404) on loopback rendered 19 bundled cards. This exercised the static preview branch. |
| Source/evidence guardrails | Regression cases rejected unsourced features and specifications, negative resolution, a mismatched category/subcategory pair and an unrelated external image before the write. |

## Cleanup and limits

Supabase CLI stopped only vt-p11-local with backups disabled. A separate Docker query found **0 matching containers and 0 matching volumes**. This removed the fixture accounts, seeded rows and synthetic enquiry. The test JPEG's digest and directory contents were checked before removal. A subsequent filesystem check confirmed the synthetic directory was absent.

The first sandboxed Node regression attempt could not open loopback sockets (EACCES). The final suite passed with loopback access. During a later browser rerun Docker Desktop's named pipe was unavailable. After Docker Desktop started, the same local stack passed the rerun. No staging data, hosted sender or production deployment was used.

The browser exercised the combined filter and newest-sort path. Exhaustive permutations of all sort choices, screen-reader behavior and multi-host upload storage were outside this run. Live Server preview behavior was simulated with a local HTTP 404. The VS Code extension itself was not launched. Hosted bootstrap, shared storage, and migration application remain deployment prerequisites.
