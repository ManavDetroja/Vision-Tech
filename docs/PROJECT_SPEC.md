# VisionTech Solutions™ — Project Specification

## Scope completed through Prompt 08 Contact and enquiry experience milestone

- Static, Live Server-compatible site foundation using HTML5, CSS3, and ES6 modules.
- Root `index.html` is the public entry point.
- Public page shells: Home, Products, Product Details, Services, About, and Contact.
- Admin page shells: entry, dashboard, products, and settings, plus the local CP PLUS product-import tool.
- Shared navigation, footer, cards, badges, state views, and modal utilities.
- Brand tokens and responsive base styles.
- Premium homepage with hero, services, category preview, benefits, about preview, and closing CTA.
- Original approved JPEG logo in public navigation, footer, and homepage brand preview.
- PNG favicon assets (16×16, 32×32, and 180×180 Apple touch icon) derived from the original logo using a contain treatment.
- Readable, consistently formatted HTML, CSS, and JavaScript across the complete project.
- White-and-blue commercial visual system with a transparent official logo.
- Catalogue with 22 supplied model records, six centralized categories, search, filters, sorting, and reusable model detail pages.
- Shared product records in `js/data/products.json`, consumed by catalogue and product detail views.
- Optional local importer for official CP PLUS product page lookups and explicitly approved catalogue updates.
- Reusable product detail experience for all 22 existing records using `product-details.html?model=...`.
- Product attributes not present or not verified in catalogue data are labeled “Not yet verified”; no model claims are inferred.
- Product detail enquiry links route to the shared contact form with the exact catalogue model prefilled.
- Responsive services page covering installation, troubleshooting, maintenance, system upgrades and security consultation, with service availability subject to confirmation.
- Installation approach, service FAQs, related catalogue categories, and contact-page enquiry links.
- Professional About page with truthful business introduction, six business areas, six customer approach steps, mission, vision, six core values, and factual reasons to consider VisionTech.
- About page uses the shared navigation/footer, approved transparent logo, responsive white-and-blue design system, and existing product/services/contact routes.
- Professional Contact page with responsive enquiry form, inline client-side validation, consent notice, configurable unpublished contact channels, and product/service query prefill.
- Contact submission is explicitly disabled until a backend endpoint is configured. The frontend preserves entered fields on failure and does not claim delivery without the documented API acceptance response.

## Intentional exclusions

No prices, stock, ratings, contact details, owner names, dealer claims, reviews, awards, addresses, establishment date, experience claims, coverage areas, or statistics have been invented. Contact publication switches are disabled and submission backend configuration is pending. Service availability is subject to confirmation. Product specifics remain unpublished until a matching official source is reviewed. Product image permissions remain pending; no product image is published. The unconfirmed 18-month free servicing claim is not shown on the public homepage.

## Technology constraints

- HTML5, CSS3, and vanilla JavaScript only.
- No framework, TypeScript, JSX/TSX, compilation, or build step. The optional importer is a separate local Node utility using built-in modules only; it is not a frontend framework or public-site runtime dependency.
- All site paths are relative and work through VS Code Live Server.

## Prompt 09 — secure administration and enquiries

- Added private admin screens and vanilla-JS views for overview, enquiries/detail, product/service editing, staff, notifications, and publication settings.
- Added optional built-in Node HTTP API (`services/admin-api.mjs`) for Supabase Auth sessions, role checks, admin endpoints, public catalogue reads, contact settings, and enquiry creation.
- Added Supabase SQL migration with RLS-protected customer records, unique enquiry IDs, NEW status, idempotency, server-side validation, rate limits, private notes, assignments, in-app notifications, email outbox, audit events, and role-guarded mutations.
- Added server-only Resend email notification handling with recorded delivery failures and retry endpoint; no credentials are present in the repository.
- Added a seed script for the existing 22 catalogue products and current services. It does not create staff or customer records.
- No backend secrets, Supabase project, email sender or deployment were present, so the service is not live-operational until configured and tested.
