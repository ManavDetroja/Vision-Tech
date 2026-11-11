# Contact Form and Enquiry Backend

## Current status

The Contact page performs client-side validation and supports product/service query prefill. Live enquiry delivery is **not operational in this checkout**. `PUBLIC_API_BASE_URL` and `ENQUIRY_API_URL` in `js/data/contact-config.js` are intentionally empty, so a valid submit displays an honest not-configured message and sends or stores nothing. The page does not put enquiry data in `localStorage`, cookies, or a public database. The optional implementation is `services/admin-api.mjs` plus the Supabase migration; see `docs/DEPLOYMENT.md`.

All public contact information switches in `js/data/contact-config.js` default to `false`; all associated values are blank. Do not enable a switch until the corresponding business detail and its publication are approved.

## Frontend integration interface

When the API is deployed, set `PUBLIC_API_BASE_URL` to its HTTPS origin (or set `ENQUIRY_API_URL` directly to `/api/enquiries`). These are public URLs, not secrets. The frontend sends a JSON `POST` request with:

```json
{
  "name": "Customer name",
  "email": "customer@example.com",
  "phone": "+1 555 010 0200",
  "enquiryType": "product",
  "productModel": "Optional model number",
  "serviceRequirement": "Optional requirement summary",
  "message": "Customer message of at least 20 characters",
  "consent": true,
  "website": ""
}
```

The supplied API returns success only after Supabase confirms the enquiry, notifications, and outbox were saved, with `{ "accepted": true, "enquiryId": "...", "savedAt": "..." }`. Email is attempted after commit; its status is tracked separately. Non-success responses, invalid acknowledgements, timeouts and network errors display failure feedback and leave the entered values in place. Stable idempotency keys prevent a retry from creating a second enquiry.

## Backend requirements

The endpoint must independently validate and normalize every field, enforce the same size limits, reject malformed email/phone/type values, require consent, and safely handle the honeypot field. Never trust browser validation. Escape data at any later display, prevent header injection, and avoid logging message bodies or contact details unnecessarily.

Use HTTPS. Keep mail-provider keys, database credentials and other secrets in the server's environment, never in HTML or JavaScript. Restrict CORS to the deployed site origin, use request-size limits, rate limiting and server-side spam controls, and return generic errors that do not disclose internal configuration. Provide monitoring that does not expose enquiry content.

## Deployment and configuration

1. Deploy Supabase and the Node API following `docs/DEPLOYMENT.md`.
2. Configure the server-only environment variables and email delivery/recipient configuration.
3. Test with synthetic data in staging, including failed email delivery and duplicate retries.
4. Set the public API URL in `js/data/contact-config.js`, then test from the deployed origin.
5. Publish contact details only after the business approves the exact value for display.

VS Code Live Server can run the frontend locally, but it is not an enquiry backend. No production credentials, endpoint, deployment or live delivery test are configured in this repository.

## Privacy and data lifecycle

- The page collects only name, email, phone, enquiry type, optional model, service requirement, message and explicit consent.
- Query parameters may prefill only a catalogue model that matches a current record; service prefill uses a fixed allowlist. Do not put customer information in a URL.
- Without an endpoint, form values remain in page memory until navigation/close and are neither transmitted nor persisted by the site.
- With an endpoint, values are transmitted only after validation and consent. Server/provider handling and retention then apply; the operator must approve a privacy notice, retention period, deletion process, access controls and a response workflow before enabling production submission.
- Do not solicit passwords, payment data, identity documents or other sensitive personal information through this form.
