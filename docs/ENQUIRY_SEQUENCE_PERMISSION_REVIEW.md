# Enquiry sequence permission review

2026-11-16. **Explicitly approved, deployed and verified on staging.** Current ACL is postgres-only. See BACKEND_MIGRATION_DEPLOYMENT_REPORT.md for deployment output, 39 hosted assertions and successful no-email HTTP checks. The baseline and review below record pre-deployment findings.

## Current evidence and cause

Read-only staging catalog query confirmed public.enquiry_number_seq owner postgres and ACL:

```text
{postgres=rwU/postgres,anon=rwU/postgres,authenticated=rwU/postgres,service_role=rwU/postgres}
```

r/w/U are SELECT/UPDATE/USAGE. Its only recorded pg_depend relationship is schema public; no OWNED BY column dependency exists. The original submit_public_enquiry body explicitly invokes nextval('public.enquiry_number_seq'). PL/pgSQL textual references are not fully represented by catalog dependencies, so the function body was also inspected. The RPC owner is postgres and SECURITY DEFINER is true, with hardened search_path retained.

The prior deployment audit and current hosted default ACL review establish broad default sequence grants for new postgres-owned public sequences. The first migration explicitly granted service_role usage/select but never revoked inherited client grants. This is an omission in least-privilege hardening, not a missing/failed historical migration.

## Minimum correction

Applied migration: supabase/migrations/20261116130000_enquiry_sequence_privileges.sql
SHA-256: `4bbbe374343541e51c083989a76cd99f95b47b465b6872aba0c30822b1d6dd52`

```sql
revoke all privileges on sequence public.enquiry_number_seq
from public, anon, authenticated, service_role;
```

The backend needs EXECUTE on submit_public_enquiry, which remains unchanged. The postgres-owned definer function retains owner sequence access. Direct service-role sequence SELECT/UPDATE/USAGE is unnecessary, so it is revoked too. No table grants, RLS policies, function grants, owner, sequence value or other object changes. Original applied migrations remain untouched.

## Local verification

Disposable local stack: vt-prompt5-local-20261116, copied under C:\Users\LEGION\AppData\Local\Temp\VT_PROMPT5_LOCAL_20261116. No remote linkage or .env copied. All three original migrations plus both drafts applied in order without SQL errors. Original security suite passed 21/21. New suite passed 18/18, including denied nextval, setval and last_value reads for anon, authenticated AND service_role; legitimate service RPC creation; unchanged RLS and service-only RPC execution. Actual local HTTP creation also passed with direct sequence privileges removed.

Never test unauthorized setval against the unfixed remote sequence: it could succeed and change state. Remote unauthorized-operation tests were deliberately not attempted before approval. This was the pre-approval baseline; the deployed ACL is now postgres-only and denied operations were tested after read-only privilege verification.

## Reversal / recovery

If restoration of the observed pre-change ACL is explicitly approved, the inverse is:

```sql
grant select, update, usage on sequence public.enquiry_number_seq
to anon, authenticated, service_role;
```

This restores the previously excessive grants, so prefer fixing any demonstrated legitimate dependency before reversal. Do not grant PUBLIC privileges, reset sequence values, edit historical migrations or repair the ledger. Sequence gaps caused by transactions/tests are normal and must not be rewound.

## Separate optional-email migration

Applied migration: supabase/migrations/20261116130100_optional_enquiry_email.sql
SHA-256: `81b2792b09825732fcc0f96c17ff41aa8e98f90bba06aabe894513437813825c`

This replaces only submit_public_enquiry, preserving its signature, owner, SECURITY DEFINER behavior, hardened search_path and grants. A missing/blank email is accepted and stored as empty text in the existing NOT NULL column. Supplied malformed email is still rejected. This avoids fake email addresses, schema weakening, table changes or alteration of historical migrations. Local SQL and HTTP tests passed. Reversal would be a new migration restoring the pre-change function definition with its hardened search_path; existing blank-email records would remain and must not be silently deleted or fabricated. No reversal was applied.

## Approval procedure

1. Review these two files and their hashes; confirm linked project fszrsispjxunckknphaw and the current ledger of three original versions.
2. After explicit authorization for the next staging deployment, rerun a dry run with CLI 3.1.0 and explicit --remote=fszrsispjxunckknphaw. Expect ONLY these two pending versions, sequence first then optional email.
3. Stop on any discrepancy. Deploy only with explicit approval; do not repair/reset or auto-rollback.
4. Recheck sequence ACL, unchanged function permissions/search_path and ledger. Exercise optional-email HTTP submission with scoped synthetic cleanup. Review fixture prerequisites before any hosted SQL suite (the new file is marked local-only).

Approved deployment completed: staging ledger contains the three original versions plus 20261116130000 and 20261116130100. The original review did not deploy them; subsequent explicit user approval authorized the deployment recorded in BACKEND_MIGRATION_DEPLOYMENT_REPORT.md.
