# VisionTech Solutions™

Static website foundation for **VisionTech Solutions™** — *SMART SECURITY. TRUSTED SOLUTIONS.*

The premium commercial website uses the approved transparent logo in `assets/images/logo/visiontech-vt-logo.png`; the supplied source remains untouched at the project root. Public pages use a shared static JSON catalogue that can be updated through the local CP PLUS importer after an administrator reviews and approves a matching result.

## Run locally

1. Open `C:\Vision Tech` in VS Code.
2. Install/use the VS Code **Live Server** extension if it is not already available.
3. Open `index.html` and select **Go Live**.

No frontend install, build step, package manager, or framework is required. The optional product importer uses Node's built-in modules only.

## Optional CP PLUS importer

See [docs/CPPLUS_IMPORTER.md](docs/CPPLUS_IMPORTER.md) for setup. The importer requires a separate local Node process for official-source lookups and approved catalogue writes. Approval requires an environment token; product image permission remains pending until commercial use is documented. The root `index.html` works independently through Live Server.

## Structure

```text
index.html                 Public entry point
products.html              Public product shell
product-details.html       Public product detail shell
services.html              Public services shell
about.html                 Public about shell
contact.html               Public contact shell
admin/                     Static admin shells
assets/                    Approved images and icons
css/                       Shared, homepage, responsive, animation, and admin styles
js/                        ES modules, components, data, features, utilities
services/                  Optional local CP PLUS importer utility
docs/                      Project records and checkpoint notes
```

## Content policy

Do not add product details, pricing, contact information, customer claims, awards, dealer status, or business statistics unless supplied or explicitly approved. See [docs/PROJECT_SPEC.md](docs/PROJECT_SPEC.md) and [docs/CODEX_PROGRESS.md](docs/CODEX_PROGRESS.md).
