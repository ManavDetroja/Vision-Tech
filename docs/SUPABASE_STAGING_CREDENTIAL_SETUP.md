# Supabase Staging Credential Setup

**Prepared:** 2026-11-13  
**Status:** Code and local setup template prepared. No Supabase connection was made, no migration was applied, and no administrator was created.

## Backend that needs credentials

The private Node API at `services/admin-api.mjs` needs the staging URL and both API keys, plus its own origin and cryptographic settings. It performs server-side authentication, role checks, enquiry operations, and protected admin operations. VS Code Live Server serves only static files and does not run this API.

The optional `services/seed-admin-data.mjs` utility also reads `SUPABASE_URL` and the server-only secret key. Do not run it as part of configuration checking; it sends database writes.

## Exact local environment file

Create or update:

```text
C:\Vision Tech\.env
```

The tracked root `.env.example` contains placeholders only. Copy it to `.env`, then replace the Supabase URL and key placeholders locally. Do not paste real credentials into chat, source files, browser code, or this report. No `.env` file was created or read during this task.

Required server variables:

| Name | Purpose |
|---|---|
| `SUPABASE_URL` | The staging project's API URL. |
| `SUPABASE_PUBLISHABLE_KEY` | Public app/API key; used in `apikey`, not as a user token. |
| `SUPABASE_SECRET_KEY` | Server-only elevated API key; never put in frontend code. |
| `APP_ORIGIN` | Exact allowed site origin. |
| `SESSION_ENCRYPTION_KEY` | 64 hexadecimal characters for the API's AES-256-GCM session cookie. |
| `RATE_LIMIT_HASH_SECRET` | At least 32 random characters. |

Email delivery settings (`RESEND_API_KEY`, `ENQUIRY_FROM_EMAIL`, `ENQUIRY_NOTIFICATION_EMAIL`, and `ADMIN_DASHBOARD_URL`) are optional until email is configured.

## API key and authorization compatibility

The API now accepts the current variables above. For transition compatibility, it also accepts `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` as legacy aliases when the corresponding current variable is absent. Do not set both forms to different projects.

For new `sb_publishable_...` and `sb_secret_...` keys, requests send the API key in `apikey`. They are not JWTs and are not sent in `Authorization: Bearer`. Authenticated requests send the signed-in user's Supabase access token as the bearer token. The API validates that user through Supabase Auth and requires an active profile and allowed role before private routes proceed. New secret-key requests remain server-side. The API's legacy-only path may use a legacy service-role JWT for service authorization; it is never used as a signed-in user's token.

Supabase documents publishable keys for client/application identification, secret keys for trusted server components, and user JWTs separately for signed-in user identity: [API keys](https://supabase.com/docs/guides/getting-started/api-keys), [authorization headers](https://supabase.com/docs/guides/functions/auth-headers).

## Environment loading and safe check

The Node API reads `process.env`; it does not load `.env` automatically. From the project root, Node 24 can load the local file for a process with:

```powershell
node --env-file=.env services/admin-api.mjs
```

Before starting the API, check variable presence and format without revealing values or contacting Supabase:

```powershell
node --env-file=.env scripts/check-staging-env.mjs
```

The checker prints only variable names, presence/format results, recognized key format (new or legacy), and that connectivity was not tested. It makes no network requests. A successful check is not proof of Supabase connectivity.

## GitHub and secret handling review

- Root `.gitignore` excludes `.env` and `.env.*`; exception rules keep `.env.example` trackable. `git check-ignore` confirmed `.env`, `.env.local`, and nested real env-file paths are ignored, while `.env.example` is not.
- No `.env` or `.env.example` existed before this task. The new `.env.example` contains placeholders only.
- The public remote exposed only `main` when checked. All 156 unique blob objects reachable from the fetched `origin/main` history were scanned for tracked real environment files, Supabase secret-key patterns, legacy service-role JWTs, private-key blocks, common provider tokens, credential assignments, and database connection URIs. No actual credentials were detected. The one assignment-shaped match was the documented angle-bracket placeholder in `docs/DEPLOYMENT.md`; no secret values were printed.
- Current browser source does not reference `SUPABASE_SECRET_KEY`, legacy service-role credentials, or an `sb_secret_` value. The local virtual environment and its oversized binaries are ignored and were not part of public `main` history.

## Remaining manual setup

1. In the staging Dashboard, confirm the project is `VisionTech-Staging` and copy its URL, publishable key, and secret key directly into `C:\Vision Tech\.env` on your computer. Do not send the values to me.
2. Set `APP_ORIGIN` to the exact local site origin you use, and generate the session and rate-limit secrets locally with a password manager or secure random generator.
3. Run the safe configuration check above. Share only whether it passed and any missing variable **names**, never values.
4. Do not run the API, seed utility, Supabase CLI link, or migrations yet. Staging connectivity, migration history review, and database verification are a separate next step; this task intentionally performed none of them.
