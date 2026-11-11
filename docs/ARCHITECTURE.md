# Architecture

The project is a static multipage application. Each HTML page loads shared styles and an ES module through a relative path. This makes each page independently accessible from VS Code Live Server.

```text
HTML pages
  └─ js/app.js
      └─ js/components/layout.js       shared navbar and footer
      └─ js/components/modal.js        reusable modal controller
      └─ js/components/cards.js        product/category card renderers
      └─ js/components/states.js       loading and empty-state renderers
      └─ js/features/home.js           homepage section rendering
      └─ js/features/reveal.js         reduced-motion-aware reveal behavior
      └─ js/features/catalogue.js      catalogue search, filters, sorting, cards
      └─ js/features/product-details.js reusable model detail view
          └─ js/features/product-enquiry.js validated, non-sending enquiry demo
      └─ js/features/services.js       services page composition
          └─ js/components/service-sections.js reusable service/process/FAQ/category renderers
      └─ js/features/about.js          About page composition
          ├─ js/data/about.js          About content and business-area source data
          └─ js/components/about-sections.js reusable About card/step renderers
      └─ js/features/contact.js        enquiry validation, prefill and optional API adapter
          └─ js/data/contact-config.js publication switches and public endpoint URL
  └─ js/admin/app.js                   authenticated admin dashboard views
      └─ js/data/admin-config.js        private API base URL only (no credentials)

services/admin-api.mjs is an optional built-in Node HTTP service. It integrates Supabase Auth/PostgREST and keeps service-role and email credentials server-side. The SQL/RLS migration is `supabase/migrations/202611120001_secure_admin.sql`. The website remains static/vanilla JS, while enquiry persistence and admin authentication require the separately deployed API and Supabase project.
```

`js/data/products.json` is the catalogue source of truth. `js/data/products.js` loads it for public ES modules. The local-only `services/cpplus-importer.mjs` retrieves official CP PLUS pages and writes an approved record to that JSON file; it uses Node built-ins and is separate from the static website. Admin UI behavior lives in `js/admin/`.

Product detail routing reads the `model` query parameter and selects one record from the shared catalogue. A single rendering module builds the breadcrumbs, product summary, technical table, feature and application states, same-category related links, and an enquiry link to the contact form. The link carries only the exact model and product enquiry type; customer fields are not prefilled.

The Services page composes service cards, detail panels, installation steps, FAQ disclosures and category links from `js/data/services.js` and the existing category records. Reusable markup is rendered by `js/components/service-sections.js`; the page-specific composition lives in `js/features/services.js`. Service-to-product links use the catalogue's existing category query parameters. Service enquiry CTAs lead to `contact.html` with an allowlisted enquiry type and service key; private contact fields are not published.

The importer is restricted to loopback, official manufacturer hosts, and the configured Live Server origin. An environment token is required for writes. The product import preview is not public catalogue content until a user explicitly approves it. Product image paths remain empty while commercial rights are pending.

`js/data/categories.js` stores the six category definitions and subcategories. Page-specific behavior belongs in `js/features/`; generic DOM helpers belong in `js/utils/`.

`js/data/categories.js` is the single source for the homepage category labels, descriptions, icons, and catalogue query parameters. Homepage-specific styling is kept in `css/home.css`; lightweight reveal behavior is in `css/animations.css` and `js/features/reveal.js`.

The About page uses static semantic section markup in `about.html`, with business facts and approved mission/vision direction separated into `js/data/about.js`. `js/features/about.js` fills the content regions using reusable escaped renderers from `js/components/about-sections.js`. It shares the existing layout, logo, tokens and reveal behavior. Its internal links point to the existing product, services and contact pages. Owner information is intentionally omitted.

The Contact page validates input, allowlists query-based model/service prefills, conditionally renders approved public contact channels, and submits JSON only when the API URL in `js/data/contact-config.js` is configured. The URL remains empty by default. The Node API validates again, applies database-backed rate limits and idempotency, enforces origin policy and saves to Supabase before confirming success. Email failures are stored in the outbox without losing the enquiry. Customer data is not persisted in browser storage. See `docs/DEPLOYMENT.md`, `docs/SECURITY.md`, and `docs/ENQUIRY_WORKFLOW.md`.

Admin pages use an encrypted HttpOnly session cookie issued by the Node API. Per-request role checks complement database RLS. No customer enquiry or staff records are fabricated. Apply the migration and bootstrap a super admin only in an approved Supabase project.

## Asset policy

Place approved assets in the matching `assets/images/` subdirectory. Keep image references relative to the HTML document that uses them. Manufacturer images remain unpublished until commercial reuse permission is documented.

The current official source logo remains untouched at `visiontech_vt_logo_transparent.png`. The byte-identical site copy is `assets/images/logo/visiontech-vt-logo.png`. Favicon derivatives are `favicon-16x16.png`, `favicon-32x32.png`, and `apple-touch-icon.png` in the same directory. The earlier JPEG is retained as an unused historical source only.
