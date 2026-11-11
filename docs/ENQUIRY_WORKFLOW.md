# Customer enquiry workflow

1. The public Contact form validates and sends JSON plus a stable retry `Idempotency-Key` to `/api/enquiries` only after the API URL is configured.
2. The Node API verifies the origin and validates all fields, consent and honeypot. PostgreSQL validates them again and applies a rate limit using an HMAC of the client address.
3. One database transaction creates the unique `VT-YYYYMMDD-######` record with status `NEW`, then creates private in-app notifications, an email outbox row and an audit event. The API reports success only after PostgreSQL confirms the saved row.
4. Email delivery runs after the database transaction. The enquiry remains saved if the provider is unavailable; the outbox stores `FAILED` and a retry can be initiated by an admin. Provider idempotency uses the outbox ID.
5. Authenticated administrators search, filter, assign, add private notes, change status, resolve, and (SUPER_ADMIN only) delete after a browser confirmation and server authorization.

The static frontend has no backend configured in this checkout. Until deployment, it explicitly says no submission was transmitted or saved. Real enquiry submission, database persistence, role authorization, delivery and unauthorized-access tests have not been performed here.
