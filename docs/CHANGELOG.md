# Changelog

## 2026-11-12 — Prompt 05 product details

- Expanded the existing model-query detail route with reusable product summary, breadcrumbs, feature/specification/application sections, related products, and category navigation.
- Used only current catalogue fields; missing or unverified information is labeled accordingly, and existing image placeholders remain unchanged.
- Added the “Enquire About This Product” dialog with required customer fields, browser validation, and an automatically populated model number.
- Labeled the enquiry flow as a demonstration: the form sends and stores nothing because no submission service exists.
- Added responsive detail and enquiry styles without changing the public site's white-and-blue theme.
- Verified 22 data-driven model routes, correct model display, unknown-model handling, category-matched related products, syntax, and local asset references with static/runtime harness checks. Visual browser checks remain blocked because browser access is disabled.

## 2026-11-12 — Automated CP PLUS importer

- Added exact official catalogue search and conservative product page extraction in the local Node utility.
- Added token-protected approvals that persist reviewed fields into the shared `js/data/products.json` catalogue.
- Updated public product cards and detail pages to render imported catalogue content and approved local asset paths.
- Kept manufacturer image downloads disabled while commercial reuse permission is pending; no product images were copied.
- Documented the actual limitation: local socket and outbound Node network requests are blocked in this execution environment, so no live batch or approval write is claimed.
- Updated official source research from 17 to 19 partial model matches after confirming CP-ANW-HPU8H2-N12 on its exact official page; three models remain unresolved.

## 2026-11-12 — Product enrichment research

- Researched all 22 exact models against official CP PLUS search results.
- Added a verification report with confirmed page matches, unresolved models, datasheet follow-up, and image permission status.
- Left catalogue data and imagery unchanged while commercial media permissions and complete structured source review remain outstanding.

## 2026-11-12 — CP PLUS importer prototype

- Added a vanilla JavaScript admin importer with single lookup preview and sequential fetch-all queue for the existing 22 models.
- Added a separately run, loopback-only Node service for controlled official-source lookup.
- Kept approval non-persistent pending authentication and a durable catalogue publishing path; no products were auto-published.

## 2026-11-12 — Prompt 04

- Added a centralized catalogue for the 22 supplied models and six category definitions.
- Added interactive search, combined filters, sorting, responsive catalogue cards, and model detail pages.
- Added verification labels and honest placeholders for missing product images or unsupported specifications.

## 2026-11-11

### Prompt 03 — Full refactor and commercial redesign

- Reformatted all project HTML pages, CSS files, and JavaScript modules for manual readability.
- Replaced the public website's dark palette with a centralized white-and-blue commercial design system.
- Replaced all active logo references with the supplied transparent VisionTech logo.
- Regenerated PNG favicon assets from the new transparent logo.
- Updated the homepage hero, cards, category preview, benefits, about preview, CTA, navigation, footer, placeholders, and admin shell to use the new visual system.
- Preserved existing vanilla JavaScript architecture, centralized category data, navigation destinations, accessibility behavior, and privacy safeguards.

### Prompt 02 — Homepage and brand integration

- Added premium responsive homepage sections and lightweight scroll reveal behavior.
- Replaced the public text-mark substitute with the approved original VisionTech JPEG in public navigation, footer, and homepage brand preview.
- Added PNG favicon assets derived from the approved logo and referenced them from every public page.
- Added centralized homepage category data and responsive homepage styles.
- Updated homepage metadata and Open Graph basics without unverified structured business claims.

### Added

- Vanilla static multipage project structure.
- Dark navy / electric blue brand system and responsive styling.
- Shared navigation, footer, modal, cards, badges, loading, and empty-state utilities.
- Public and admin shell pages.
- Project specification, architecture notes, task list, and progress checkpoint.

### Not added

- Homepage marketing content, product data, contact information, pricing, specifications, authentication, or persistence.
