# Supabase invitation and recovery configuration

Read-only review: 2026-11-22. Project VisionTech-Staging, reference `fszrsispjxunckknphaw`; local link and explicit remote target match. Hosted settings and the real .env were **not modified**.

## Observed settings and exact local verification URLs

| Setting | Observed / required |
| --- | --- |
| Hosted Auth Site URL | Currently `http://localhost:3000` |
| Hosted additional redirects | Currently empty |
| Public signup | Currently enabled; new profiles still default to disabled STAFF |
| Existing backend APP_ORIGIN | `http://127.0.0.1:5500` |
| Proposed Site URL for testing this existing local origin | `http://127.0.0.1:5500` |
| Required recovery redirect | `http://127.0.0.1:5500/admin/reset-password.html` |
| Required invitation redirect | `http://127.0.0.1:5500/admin/accept-invitation.html` |

These are exact localhost testing values derived from the existing non-secret APP_ORIGIN. They are not a proposed public commercial domain. No hosted staging website URL was supplied. For a hosted staging site, approve its exact HTTPS origin first and replace all three URLs consistently. Do not use wildcard redirects. The API and frontend must be served through the supported same-origin proxy (or carefully verified same-site arrangement); Live Server alone does not implement `/api`.

## Invitation template and enabling sequence

1. Owner approves changes on the exact staging reference. No hosted configuration change is implied by this document.
2. Configure Site URL and both exact redirect URLs in Supabase Auth URL Configuration. The documented invite API can otherwise ignore an unallowlisted redirect and fall back to Site URL: [official user/invitation guidance](https://supabase.com/docs/guides/auth/users).
3. Configure Supabase Auth SMTP with a verified sender and approved recipient inbox. SMTP secrets remain in Supabase/secret storage. Supabase Auth mail is separate from the application's enquiry email provider. Default Supabase email service has recipient/rate restrictions; see [Auth SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
4. Review `supabase/templates/invite.html` and install it as the **Invite user** email template. Its action URL is `{{ .RedirectTo }}#token_hash={{ .TokenHash }}`. A fragment avoids putting the token in the frontend server request URL. Never paste an actual token into repository documentation or chat.
5. The default implicit-token invite redirect is intentionally unsupported by this app. The API accepts only a provider-verified invite token hash and issues an opaque setup cookie. It does not accept an arbitrary browser access token as invitation proof. Template details are documented by [Supabase](https://supabase.com/docs/guides/auth/auth-email-templates).
6. After approving/checking template, sender and redirects, set `STAFF_INVITATION_EMAIL_CONFIGURED=true` in the backend secret environment for a controlled acceptance test. Default false keeps the invitation route and button disabled. This flag is an operator attestation, not proof that delivery works. Do not set it in browser JavaScript.
7. Inspect Auth email OTP expiry. The app caps tracked invitation setup at one hour; the provider can expire its token earlier. Do not increase provider validity merely to make a test pass.

Recovery retains the Prompt 6 PKCE flow: request reset in one browser, open the delivered link in that same browser, exchange its code through server-held verifier state, and set a new password. No recovery-template change is required for that standard flow. Recovery/invitation URLs are removed from the address bar; redact URL queries in proxy logs and keep auth pages no-referrer. Do not log message bodies, links or tokens in test reports.

## Email acceptance plan (not yet executed on hosted staging)

- Obtain an owner-approved test inbox and explicit authorization for that named staging fixture. No real staff account or password should be sent through chat.
- Confirm staging reference, sender, exact allowlists and API origin. Keep real administrator bootstrap separate.
- Invite a disposable STAFF account via an authorized test actor; confirm the actual message reaches the inbox, including spam handling. API acceptance alone is not delivery evidence.
- Open its exact invitation link, verify the fragment is removed, set a password privately, sign in, confirm STAFF-only access and sign out.
- Request password recovery, verify actual message receipt and same-browser completion, then confirm new-password login and rejection of the old password.
- Test consumed/invalid links, expired setup, deactivation and attempted privilege escalation. Record only safe outcome/status/timestamp evidence.
- Clean up only approved disposable users and their test records after checking ownership. Keep production untouched. Retain an explicit result for both delivery and browser completion.

**Executed locally:** Supabase invite reached a loopback SMTP sink; the test extracted its provider token in memory, verified it through the real API, set a password and logged in. This is not evidence of hosted SMTP delivery, custom-template link clicking, or a hosted recovery email round trip. All remain pending approval/configuration and an approved inbox.
