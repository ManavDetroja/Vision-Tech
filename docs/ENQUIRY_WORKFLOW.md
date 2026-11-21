# Customer enquiry workflow

1. The public Contact form validates and sends JSON plus a stable retry `Idempotency-Key` to `/api/enquiries` only after the API URL is configured.
2. The Node API verifies the origin and validates all fields, consent and honeypot. PostgreSQL validates them again and applies a rate limit using an HMAC of the client address.
3. One database transaction creates the unique `VT-YYYYMMDD-######` record with status `NEW`, then creates private in-app notifications, an email outbox row and an audit event. The API reports success only after PostgreSQL confirms the saved row.
4. Email delivery runs after the database transaction. The enquiry remains saved if the provider is unavailable; the outbox stores `FAILED` and a retry can be initiated by an admin. Provider idempotency uses the outbox ID.
5. Authenticated administrators search, filter, assign, add private notes, change status, resolve, and (SUPER_ADMIN only) delete after a browser confirmation and server authorization.

Update 2026-11-16: same-origin Contact integration and staging persistence/duplicates/rate limiting/anonymous read protection were tested with synthetic cleanup. Real email delivery and complete admin workflows are not verified. The two backend migrations are now approved, deployed and verified on staging; see ENQUIRY_API_TEST_REPORT.md and ENQUIRY_SEQUENCE_PERMISSION_REVIEW.md. Live Server alone still provides no backend.
