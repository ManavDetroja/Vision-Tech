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
```

`js/data/products.json` is the catalogue source of truth. `js/data/products.js` loads it for public ES modules. The local-only `services/cpplus-importer.mjs` retrieves official CP PLUS pages and writes an approved record to that JSON file; it uses Node built-ins and is separate from the static website. Admin UI behavior lives in `js/admin/`.

Product detail routing reads the `model` query parameter and selects one record from the shared catalogue. A single rendering module builds the breadcrumbs, product summary, technical table, feature and application states, same-category related links, and enquiry CTA. The enquiry module opens an accessible native dialog, uses browser validation, pre-fills the selected model, and never transmits or stores form fields.

The importer is restricted to loopback, official manufacturer hosts, and the configured Live Server origin. An environment token is required for writes. The product import preview is not public catalogue content until a user explicitly approves it. Product image paths remain empty while commercial rights are pending.

`js/data/categories.js` stores the six category definitions and subcategories. Page-specific behavior belongs in `js/features/`; generic DOM helpers belong in `js/utils/`.

`js/data/categories.js` is the single source for the homepage category labels, descriptions, icons, and catalogue query parameters. Homepage-specific styling is kept in `css/home.css`; lightweight reveal behavior is in `css/animations.css` and `js/features/reveal.js`.

## Asset policy

Place approved assets in the matching `assets/images/` subdirectory. Keep image references relative to the HTML document that uses them. Manufacturer images remain unpublished until commercial reuse permission is documented.

The current official source logo remains untouched at `visiontech_vt_logo_transparent.png`. The byte-identical site copy is `assets/images/logo/visiontech-vt-logo.png`. Favicon derivatives are `favicon-16x16.png`, `favicon-32x32.png`, and `apple-touch-icon.png` in the same directory. The earlier JPEG is retained as an unused historical source only.
