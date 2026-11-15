# Catalogue removal — current state

Checked 2026-11-15. This report supersedes the product counts in the earlier 22-product catalogue implementation and QA reports. Those reports and image acquisition records are retained as historical evidence; they are not loaded by the website.

The public catalogue now contains **19 products**. The three models requested for removal are absent from `js/data/products.json`, `config/models.json`, and `services/cpplus-product-image-config.json`. The homepage has no hard-coded featured model references; its category cards continue to link to the filtered catalogue. Product cards, search, filters, related products, contact suggestions, and detail routes all use the central catalogue data.

## Verification

- Local Chromium catalogue run: **19 models tested, 136 checks passed, 0 failed**, with no recorded normal-page console or network errors. Search, category and resolution filters, sorting, galleries, related products, enquiry prefills, mobile layouts, and image fallbacks were exercised.
- Each removed model's detail URL displayed **Product not found** and `noindex`.
- Each removed model returned zero search cards and did not prefill the product contact field.
- The homepage body contained none of the removed model codes. The active HTML, JavaScript, JSON, and service configuration scan found no removed code except the deliberate negative checks in `scripts/test-product-catalogue.py`.
- The two existing original image files for the removed models with supplied photos remain on disk. No image or unrelated asset was deleted.

The full project search still finds the codes in prior research and QA documents, original image manifests, downloader logs, and the negative test cases. These are retained records, not public catalogue inputs. The earlier 22-product QA JSON is historical and should not be used as the current catalogue count. The current run's raw output is in the local temporary `catalogue-qa-19-products/results.json` test directory.

## Files changed for this removal

- `js/data/products.json`
- `config/models.json`
- `services/cpplus-product-image-config.json`
- `services/generate-product-image-report.mjs`
- `scripts/test-product-catalogue.py`
- `docs/CATALOGUE_REMOVAL_REPORT.md` (this report)

No deployment, push, migration, authentication, or database change was performed.
