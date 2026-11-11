# CP PLUS Product Importer

## Overview

The local importer searches the exact model on the official CP PLUS catalogue and displays the page title, description, table specifications, image candidates, and PDF links it can read from that page. An administrator reviews the preview and explicitly approves eligible product data. Approval updates the shared static catalogue at `js/data/products.json`; the public catalogue and detail pages read the same JSON data source.

The public website remains HTML, CSS, and vanilla JavaScript. A small optional Node.js utility is required only for official-site retrieval and approved local file writes. No framework, package manager, dependency install, or build step is used.

## Start the website and importer

1. Open the project folder in VS Code and use **Go Live** on the root `index.html`.
2. In a separate PowerShell window, set a private local admin token and start the utility:

   ```powershell
   $env:CPPLUS_ADMIN_TOKEN = 'use-a-long-random-local-secret'
   node services/cpplus-importer.mjs
   ```

3. Open `admin/product-import.html` through Live Server at `http://127.0.0.1:5500/admin/product-import.html`.
4. Search one exact model or run the catalogue-driven 22-model queue. Enter the same token in the admin page only when importing an approved result.

The service binds only to `127.0.0.1`, allows only the configured Live Server origin, permits official CP PLUS hosts, checks `robots.txt`, validates redirects, applies timeouts, serializes upstream requests with a minimum gap, and does not proxy arbitrary URLs. `CPPLUS_IMPORTER_ORIGIN` and `CPPLUS_IMPORTER_PORT` can be changed with environment variables when local ports differ. Do not expose this utility to a public network.

The token is not stored in source code or catalogue data. Do not commit it, share it, or paste it into any external service. Approvals fail closed when `CPPLUS_ADMIN_TOKEN` is not set.

## Approval behavior

- The importer accepts only an exact model match on an official CP PLUS page; similar models are not substituted.
- A result can be approved only when the exact model, product name, and a non-empty specification table were found and the model already exists in the catalogue.
- Existing product IDs and category assignments are preserved. Existing specifications are merged with extracted fields, so absent source fields do not erase old data.
- Approval is manual for each model. Failed or incomplete results are never written.
- The JSON file is written to a temporary sibling then renamed into place. Public pages load this same JSON file with cache disabled, so a refresh displays imported names, descriptions, specifications, source links, and eligible datasheet links.
- All table fields are retained as label/value specifications rather than being restricted to a camera-only schema.

## Images and datasheets

Official image URLs are preview-only. Commercial reproduction rights cannot be inferred from public availability, so image permission remains `pending`; the service does not download images and the public website keeps its neutral placeholder. Do not set an image path until VisionTech has documented reseller/commercial-use permission for that asset.

Datasheets are not downloaded or copied. A PDF link is only imported when the official page exposes it and the model number appears in its URL; the importer labels this URL-level check and does not claim to parse or validate the PDF contents. An administrator should inspect the PDF and its terms before relying on it.

## Limits and safe failure

- CP PLUS may change its HTML, search routes, or robots policy. If search is blocked, times out, redirects away from the allowed domain, or yields no exact match, the importer reports failure and does not write catalogue data.
- Extraction uses the HTML returned by the official page. Client-rendered fields not present in the response cannot be extracted.
- The service intentionally does not bypass CAPTCHA, authentication, access controls, or anti-bot restrictions.
- The local admin token protects write operations. Local machine users able to read the current process environment can access it; use the tool only on a trusted development machine.
- A successful local edit requires the website to be served over HTTP by Live Server. Opening pages as `file://` is unsupported because the data loader uses `fetch`.

## Last verified checkpoint

- Code syntax, the 22-record JSON schema, and local source references were checked on 2026-11-12.
- The Node importer could start on loopback, but this execution environment denied local socket requests and outbound Node `fetch`. Therefore no importer HTTP lookup, actual asset download, approval write, or VS Code Live Server browser test is claimed from this run.
- Separate official web research found CP-ANW-HPU8H2-N12 at `https://cpplusworld.com/cp-anw-hpu8h2-n12`; this research is not a successful run through the importer.
