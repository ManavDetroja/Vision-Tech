# Tasks

## Prompt 08 — Contact page and customer enquiry system

- [x] Inspect existing contact, product enquiry, service enquiry, shared layout, product data and project documentation.
- [x] Replace the Contact placeholder with a responsive, accessible customer enquiry experience and privacy/consent notice.
- [x] Add client-side required, email, international phone, service requirement, message length and consent validation with inline errors.
- [x] Add allowlisted product-model and service query prefill; route product and service enquiry actions to the Contact page.
- [x] Keep contact publication switches false and public contact values blank; leave backend URL unset and report that no data was transmitted.
- [x] Document the API contract, deployment prerequisites, backend environment configuration, privacy and retention considerations.
- [x] Check JavaScript syntax, validation rules, query mappings, public contact defaults, product/service links, and failure-preservation logic.
- [ ] Verify actual form interactions, network/backend delivery, browser rendering, keyboard use, responsive breakpoints, and console in a browser; browser access is disabled in this environment and no backend is configured.

## Prompt 07 — About and professional brand identity

- [x] Inspect the existing project pages, shared design system, reusable layout, catalogue, services, and project documentation.
- [x] Replace the About placeholder with a responsive, semantic business introduction and premium white-and-blue page composition.
- [x] Add data-driven business areas, customer approach steps, mission, vision, core values, and factual reasons to consider VisionTech.
- [x] Use the approved transparent logo and existing shared navigation/footer; link to current product, service and contact pages.
- [x] Keep owner information, private contact details and unsupported business claims unpublished.
- [x] Check JavaScript syntax, content rendering, internal target pages/anchors, logo asset, metadata and responsive CSS rules.
- [ ] Verify browser rendering, keyboard interaction, desktop/tablet/mobile layouts, console, and existing page interactions; browser access is disabled in the current environment.

## Prompt 06 — CCTV services experience

- [x] Inspect the existing site structure, required project docs, services shell, shared navigation/footer, homepage, categories, and product data.
- [x] Build the services hero, availability notice, service overview cards, and detailed sections for all five requested service areas.
- [x] Add the five-step installation approach, confidence/process section, accessible FAQ disclosures, related catalogue categories, and contact-page CTAs.
- [x] Link service details to existing filtered product categories without modifying the 22 product records.
- [x] Keep the white-and-blue styling, logo, shared navigation, and Live Server paths.
- [x] Replace the unapproved 18-month free servicing claim on the public homepage with a neutral servicing-and-maintenance benefit.
- [x] Check JavaScript syntax, services data, generated internal links, shared assets and presence of required sections.
- [ ] Verify browser rendering, keyboard interaction, desktop/tablet/mobile layouts, console, and existing catalogue behavior; browser access is disabled in the current environment.

## Prompt 05 — Product details experience

- [x] Inspect the existing 22-record JSON catalogue, reusable model route, listing filters, and project documentation.
- [x] Expand the shared product route with breadcrumbs, exact model display, category/subcategory, image placeholder, and product detail sections.
- [x] Mark absent descriptions, features, applications, and unverified supplied technical data accurately.
- [x] Add same-category related product links and catalogue navigation.
- [x] Add a responsive, validated product enquiry demonstration with the selected model prefilled.
- [x] State clearly that the enquiry form does not send or retain customer data.
- [x] Check module syntax, HTML asset references, all 22 model route renderings, exact model display, not-found behavior, and related-product category boundaries.
- [ ] Run visual, responsive, enquiry-validation, catalogue-interaction, and console checks in a browser; browser access is disabled in the current environment.

## Done

- [x] Inspect existing workspace; it contained no project files to migrate.
- [x] Create static multipage foundation and root entry point.
- [x] Implement shared vanilla JS UI renderers and responsive visual tokens.
- [x] Create public/admin page shells and asset locations.
- [x] Validate local HTML, CSS, and JavaScript references.
- [x] Update documentation checkpoint.
- [x] Locate the approved original JPEG and use a preserved copy for the public brand.
- [x] Create the Prompt 02 homepage and responsive shared navigation/footer.
- [x] Add logo-derived PNG favicon assets and references to public pages.
- [x] Validate local references, JavaScript syntax, and the copied-logo integrity.
- [x] Refactor all public and admin HTML page shells into readable semantic markup.
- [x] Refactor all CSS and JavaScript modules for maintainable formatting.
- [x] Replace site branding and favicon assets with the supplied transparent official logo.
- [x] Redesign the shared visual system and homepage for a white-and-blue commercial presentation.
- [x] Add 22 supplied models using centralized category and product data.
- [x] Implement catalogue search, category/subcategory/resolution filters, sorting, and reset.
- [x] Add reusable product detail routing by exact model query parameter.
- [x] Mark unverified product information and spreadsheet channel labels accurately.
- [x] Validate product IDs, exact model list, routes, and JavaScript syntax.
- [x] Search official CP PLUS sources for all 22 exact model numbers and record findings.
- [x] Create a model-by-model verification report with exact URLs, gaps, and image rights status.
- [ ] Review the live-imported official names/specifications and approve eligible records one by one.
- [ ] Obtain confirmation of commercial image permissions or approved reseller media assets.
- [ ] Complete exact matching research for three unresolved models and validate all 22 before marking enrichment complete.
- [x] Build optional CP PLUS importer preview UI and controlled bulk queue.
- [x] Replace the importer retrieval prototype with exact-model official search and conservative page extraction.
- [x] Add local environment-token authentication for catalogue writes and restrict CORS/remote hosts.
- [x] Make `js/data/products.json` the shared catalogue source so approved local updates flow into cards and detail pages.
- [x] Retain product image placeholders while image reuse permission is pending.
- [x] Document importer setup, review requirements, and known limitations.
- [ ] Run the 22-model importer batch with CP PLUS network access and review actual fetch outcomes.
- [ ] Confirm commercial image permissions and download only approved manufacturer assets.

## Deferred — not part of Prompt 01

- [ ] Add only approved product data and imagery.
- [ ] Add approved business/contact details.
- [x] Define a local token-authenticated admin data workflow for importer approvals.

## Remaining verification

- [ ] Run the final browser/VS Code Live Server visual check. The current environment blocks localhost preview connections and exposes the Codex host rather than a standalone VS Code window. This was not marked complete.
- [ ] Re-run importer endpoint, approval-write, and public catalogue refresh checks in an environment that permits local sockets and outbound HTTPS.

## Prompt 09 — admin and enquiry backend

- [x] Add role-based admin page shells and responsive vanilla JS dashboard views.
- [x] Add Supabase schema, RLS policies, enquiry persistence/idempotency/rate limiting, notes, statuses, assignments, notification outbox and audit events.
- [x] Add server-only Node API and secret-based email delivery/retry handling.
- [x] Add existing 22-product and service seed script; no fabricated customer records.
- [x] Document API, migration, security, admin usage and deployment prerequisites.
- [ ] Configure an approved Supabase project and apply/review the migration.
- [ ] Bootstrap the first super admin and seed the supplied catalogue in the intended database.
- [ ] Configure the private Node service, HTTPS reverse proxy, approved origin, auth settings and secret manager.
- [ ] Configure an approved business sender/recipient and verify email delivery and failure recovery.
- [ ] Set the public API URLs and test an authorized enquiry end to end in staging.
- [ ] Test row isolation, disabled-account denial, staff assignment rules, mobile layout and browser console in deployed preview.
