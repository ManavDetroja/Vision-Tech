# VisionTech Solutions™ — Project Specification

## Scope completed through automated importer milestone

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
- Product enquiry form validates in the browser and clearly states that it is a demo with no send or storage service.

## Intentional exclusions

Remaining public pages beyond the catalogue are still placeholders. No prices, stock, ratings, contact details, dealer claims, reviews, awards, addresses, or statistics have been invented. Product specifics remain unpublished until a matching official source is reviewed. Image permissions remain pending; no product image is published.

## Technology constraints

- HTML5, CSS3, and vanilla JavaScript only.
- No framework, TypeScript, JSX/TSX, compilation, or build step. The optional importer is a separate local Node utility using built-in modules only; it is not a frontend framework or public-site runtime dependency.
- All site paths are relative and work through VS Code Live Server.
