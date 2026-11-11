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
```

`js/data/products.js` is deliberately empty until approved product data is available. Page-specific behaviour belongs in `js/features/`; generic DOM helpers belong in `js/utils/`. Admin shells use `js/admin/app.js` and `css/admin.css`.

`js/data/categories.js` is the single source for the homepage category labels, descriptions, icons, and catalogue query parameters. Homepage-specific styling is kept in `css/home.css`; lightweight reveal behavior is in `css/animations.css` and `js/features/reveal.js`.

## Asset policy

Place approved assets in the matching `assets/images/` subdirectory. Keep image references relative to the HTML document that uses them. Existing logo artwork should replace the current text wordmark only after it is supplied or found in the workspace.

The current official source logo remains untouched at `visiontech_vt_logo_transparent.png`. The byte-identical site copy is `assets/images/logo/visiontech-vt-logo.png`. Favicon derivatives are `favicon-16x16.png`, `favicon-32x32.png`, and `apple-touch-icon.png` in the same directory. The earlier JPEG is retained as an unused historical source only.
