# P0-05 — Supabase staging migration deployment

The original P0-05 deployment is recorded below. For the subsequent approved migration pair, see the [Prompt 10/10A staging deployment](NOTIFICATION_STAGING_DEPLOYMENT_REPORT.md).

Deployment: 2026-11-15. Final verification: 2026-11-16 (Asia/Calcutta).
Project: `C:\Vision Tech`. Target: **VisionTech-Staging**, reference **fszrsispjxunckknphaw**.

## Result

**All three approved migrations deployed successfully; remote ledger and application objects verified. The 21 existing pgTAP assertions passed against staging through the SQL query interface with an output-capture wrapper. Test fixtures were rolled back and cleanup verified.**

This is a database deployment result, not a claim that the website, email delivery, admin login or all security cases are production-ready. A sequence-permission hardening finding remains (see below). No website deployment, production access, migration repair/reset, automatic rollback or real account creation occurred.

## Authorization and preflight

The owner supplied the exact approval phrase `APPROVE VISIONTECH STAGING MIGRATION DEPLOYMENT` after the completed Stage 1 review. The later instruction to continue resumed post-deployment verification; migrations were not applied again.

Before deployment the linked marker, cached project name and configured SUPABASE_URL reference were verified against the owner-confirmed staging reference. Every hosted command explicitly targeted that reference. The CLI banner suffix `production` denotes the main/default Supabase project classification; it does not override the owner-confirmed staging identity. No other project was targeted.

CLI: 3.1.0, cached npx installation. The final preflight dry run exited 0 and listed exactly three migrations in order, with no unexpected version. The application ledger/schema was absent; Auth users and Storage buckets/objects were zero. The unchanged existing public `rls_auto_enable` function was recorded separately. Recovery Condition B was accepted: empty application state reconstructible from the locally tested original migrations. No verified full-database backup was claimed.

The five requested prior reports were reviewed. Historical local 21/21 results were not used as a substitute for hosted testing. Complete preflight streams remain in the external `p005-stage1-current.json` evidence file.

## Migration integrity and order

| Order | Original migration | SHA-256 | Deployment / remote ledger |
| --- | --- | --- | --- |

| 1 | `202611120001_secure_admin.sql` | `03920f5f77e1713606ed2429a3bac13e091d1cf6df5da0890b911bbc2c3664c7` | Applied / recorded |

| 2 | `202611120002_enquiry_lifecycle.sql` | `022c87ac5e7cae89205a0c63e41b74cec3ec274a8914a006e8513f8f8dd09f7c` | Applied / recorded |

| 3 | `20261112170000_security_hardening.sql` | `5c40e5f5c1e1c4c68d498b34e5fe1a771748bd44db660b85fa1655b7b7b50d4a` | Applied / recorded |

Hashes were verified before deployment and again after testing. Exactly these three migration files remain, unchanged and unrenamed. The external diagnostic p004-extra.sql was not deployed. No migration-history table was created manually.

## Deployment command and complete result

```powershell
npx --offline supabase@3.1.0 db push --remote=fszrsispjxunckknphaw --skip-vault --yes --output-format text
```

Working directory: `C:\Vision Tech`. Exit code **0**. The target/hash guard ran immediately before this command. `--skip-vault` avoided a Vault synchronization operation; no seed option was used.

```text
Target and all three original migration hashes verified.
Target: project VisionTech-Staging (fszrsispjxunckknphaw) · production
Initialising login role...
Confirmed by --yes: Apply 3 migrations on project VisionTech-Staging (fszrsispjxunckknphaw) · production
Applying migration 202611120001_secure_admin.sql...
Applying migration 202611120002_enquiry_lifecycle.sql...
Applying migration 20261112170000_security_hardening.sql...
Finished supabase db push.
```

## Remote migration history

```text
Local            | Remote           | Time (UTC)            
  ------------------|------------------|-----------------------
   `202611120001`   | `202611120001`   | `202611120001`        
   `202611120002`   | `202611120002`   | `202611120002`        
   `20261112170000` | `20261112170000` | `2026-11-12 17:00:00`
```

A subsequent read-only SQL query independently returned exactly `202611120001`, `202611120002`, `20261112170000` from `supabase_migrations.schema_migrations`. The ledger now exists and matches the actual objects, not merely the migration-list Time column.

## Database object verification

| Check | Observed result |
| --- | --- |
| Application tables | 10, all expected |
| Public sequence | enquiry_number_seq |
| Application columns | 75 |
| Constraints | 32, including 11 foreign keys; zero unvalidated |
| Indexes | 22, zero invalid |
| RLS | Enabled on all 10 tables |
| Policies | 10; submission_rate_limits deliberately has no client policy |
| Application functions | 21 |
| Function bodies | 21/21 body hashes match final migration definitions byte-for-byte, preserving original CRLF/LF |
| Security-definer app functions | 20, all search_path = pg_catalog, public, auth, pg_temp |
| Invoker app function | touch_enquiry_updated_at, same explicit search_path |
| Ordinary application triggers | 3, enabled |
| Enums | 4 types / 16 values |
| Pre-existing public function | rls_auto_enable unchanged, body MD5 c44fb229ea8a6b0afd04a0a33261c16c |
| Platform event triggers | Same seven names, enabled states and target functions as preflight |
| Public schema CREATE | Denied to anon and authenticated |

Tables: admin_activity, admin_notifications, email_outbox, enquiries, enquiry_notes, products, profiles, service_content, site_settings, submission_rate_limits.

The post-deployment and post-test catalog snapshots match for relations, columns, constraints, indexes, policies, functions, triggers, enums, extensions and the role-filtered grants view. The read-only role's information_schema grants view was empty, so table permissions were separately verified using pg_class.relacl and column ACLs. No unexplained application object changes were found within this inspected scope; this is not an exhaustive audit of every managed Supabase object or platform operation.

### RLS policies

- `admin_activity.activity_read_admin_or_actor`: SELECT, roles authenticated; USING `((current_admin_role() = ANY (ARRAY['SUPER_ADMIN'::text, 'ADMIN'::text])) OR (actor_id = auth.uid()) OR ((entity_type = 'ENQUIRY'::text) AND (EXISTS ( SELECT 1
   FROM enquiries e
  WHERE ((e.id = admin_activity.entity_id) AND (e.assigned_to = auth.uid()))))))`; CHECK `None`.

- `admin_notifications.notifications_read_self`: SELECT, roles authenticated; USING `((recipient_id = auth.uid()) AND is_active_account())`; CHECK `None`.

- `admin_notifications.notifications_update_self`: UPDATE, roles authenticated; USING `((recipient_id = auth.uid()) AND is_active_account())`; CHECK `((recipient_id = auth.uid()) AND is_active_account())`.

- `email_outbox.email_outbox_admin_read`: SELECT, roles authenticated; USING `(current_admin_role() = ANY (ARRAY['SUPER_ADMIN'::text, 'ADMIN'::text]))`; CHECK `None`.

- `enquiries.enquiries_read_authorized`: SELECT, roles authenticated; USING `((current_admin_role() = ANY (ARRAY['SUPER_ADMIN'::text, 'ADMIN'::text])) OR ((current_admin_role() = 'STAFF'::text) AND (assigned_to = auth.uid())))`; CHECK `None`.

- `enquiry_notes.notes_read_authorized`: SELECT, roles authenticated; USING `((current_admin_role() = ANY (ARRAY['SUPER_ADMIN'::text, 'ADMIN'::text])) OR (EXISTS ( SELECT 1
   FROM enquiries e
  WHERE ((e.id = enquiry_notes.enquiry_id) AND (e.assigned_to = auth.uid())))))`; CHECK `None`.

- `products.products_read_published`: SELECT, roles anon, authenticated; USING `(is_visible OR (current_admin_role() = ANY (ARRAY['SUPER_ADMIN'::text, 'ADMIN'::text])))`; CHECK `None`.

- `profiles.profiles_read_self_or_admin`: SELECT, roles authenticated; USING `((id = auth.uid()) OR (current_admin_role() = ANY (ARRAY['SUPER_ADMIN'::text, 'ADMIN'::text])))`; CHECK `None`.

- `service_content.services_read_published`: SELECT, roles anon, authenticated; USING `(is_visible OR (current_admin_role() = ANY (ARRAY['SUPER_ADMIN'::text, 'ADMIN'::text])))`; CHECK `None`.

- `site_settings.site_settings_admin_read`: SELECT, roles authenticated; USING `(current_admin_role() = 'SUPER_ADMIN'::text)`; CHECK `None`.

### Foreign keys

- `admin_activity.admin_activity_actor_id_fkey`: `FOREIGN KEY (actor_id) REFERENCES profiles(id) ON DELETE SET NULL`.

- `admin_notifications.admin_notifications_enquiry_id_fkey`: `FOREIGN KEY (enquiry_id) REFERENCES enquiries(id) ON DELETE SET NULL`.

- `admin_notifications.admin_notifications_recipient_id_fkey`: `FOREIGN KEY (recipient_id) REFERENCES profiles(id) ON DELETE CASCADE`.

- `email_outbox.email_outbox_enquiry_id_fkey`: `FOREIGN KEY (enquiry_id) REFERENCES enquiries(id) ON DELETE CASCADE`.

- `enquiries.enquiries_assigned_to_fkey`: `FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE SET NULL`.

- `enquiry_notes.enquiry_notes_author_id_fkey`: `FOREIGN KEY (author_id) REFERENCES profiles(id) ON DELETE RESTRICT`.

- `enquiry_notes.enquiry_notes_enquiry_id_fkey`: `FOREIGN KEY (enquiry_id) REFERENCES enquiries(id) ON DELETE CASCADE`.

- `products.products_updated_by_fkey`: `FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL`.

- `profiles.profiles_id_fkey`: `FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE`.

- `service_content.service_content_updated_by_fkey`: `FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL`.

- `site_settings.site_settings_updated_by_fkey`: `FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL`.

### Index definitions

```sql
CREATE INDEX admin_activity_created_idx ON public.admin_activity USING btree (created_at DESC);
CREATE UNIQUE INDEX admin_activity_pkey ON public.admin_activity USING btree (id);
CREATE UNIQUE INDEX admin_notifications_pkey ON public.admin_notifications USING btree (id);
CREATE INDEX notifications_unread_idx ON public.admin_notifications USING btree (recipient_id, created_at DESC) WHERE (read_at IS NULL);
CREATE UNIQUE INDEX email_outbox_enquiry_id_key ON public.email_outbox USING btree (enquiry_id);
CREATE UNIQUE INDEX email_outbox_pkey ON public.email_outbox USING btree (id);
CREATE INDEX enquiries_assigned_to_idx ON public.enquiries USING btree (assigned_to, created_at DESC);
CREATE INDEX enquiries_created_at_idx ON public.enquiries USING btree (created_at DESC);
CREATE UNIQUE INDEX enquiries_enquiry_code_key ON public.enquiries USING btree (enquiry_code);
CREATE INDEX enquiries_follow_up_idx ON public.enquiries USING btree (follow_up_at) WHERE (follow_up_at IS NOT NULL);
CREATE UNIQUE INDEX enquiries_idempotency_key_key ON public.enquiries USING btree (idempotency_key);
CREATE UNIQUE INDEX enquiries_pkey ON public.enquiries USING btree (id);
CREATE INDEX enquiries_status_idx ON public.enquiries USING btree (status, created_at DESC);
CREATE INDEX enquiry_notes_enquiry_idx ON public.enquiry_notes USING btree (enquiry_id, created_at DESC);
CREATE UNIQUE INDEX enquiry_notes_pkey ON public.enquiry_notes USING btree (id);
CREATE UNIQUE INDEX products_model_key ON public.products USING btree (model);
CREATE UNIQUE INDEX products_pkey ON public.products USING btree (id);
CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id);
CREATE UNIQUE INDEX service_content_pkey ON public.service_content USING btree (id);
CREATE UNIQUE INDEX site_settings_pkey ON public.site_settings USING btree (id);
CREATE UNIQUE INDEX submission_rate_limits_pkey ON public.submission_rate_limits USING btree (bucket_key, window_start);
CREATE INDEX submission_rate_limits_window_idx ON public.submission_rate_limits USING btree (window_start);
```

### Functions and execution permissions

All application bodies match the last applicable original migration definition. A true EXECUTE privilege is not itself permission to bypass the RPC internal role checks.

| Function | Definer | anon | authenticated | service_role |
| --- | --- | --- | --- | --- |

| admin_add_enquiry_note | True | False | True | True |

| admin_assign_enquiry | True | False | True | True |

| admin_create_product | True | False | True | True |

| admin_dashboard_stats | True | False | True | True |

| admin_delete_enquiry | True | False | True | True |

| admin_mark_notification_read | True | False | True | True |

| admin_set_email_delivery | True | False | False | True |

| admin_set_enquiry_follow_up | True | False | True | True |

| admin_set_staff | True | False | False | True |

| admin_update_enquiry_status | True | False | True | True |

| admin_update_product | True | False | True | True |

| admin_update_service | True | False | True | True |

| admin_update_site_settings | True | False | True | True |

| create_disabled_profile | True | True | True | True |

| current_admin_role | True | True | True | True |

| is_active_account | True | True | True | True |

| on_enquiry_created | True | True | True | True |

| public_contact_settings | True | True | True | True |

| record_own_login | True | False | True | True |

| rls_auto_enable | True | True | True | True |

| submit_public_enquiry | True | False | False | True |

| touch_enquiry_updated_at | False | False | False | True |

The three service-only RPCs (submit_public_enquiry, admin_set_email_delivery, admin_set_staff) deny anon/authenticated EXECUTE. Staff administration rejects ADMIN-to-ADMIN promotion and permits the tested SUPER_ADMIN promotion. No security-definer search_path mismatch was found. create_disabled_profile and on_enquiry_created retain broad trigger-function EXECUTE grants; they return trigger and cannot be invoked as ordinary SQL functions. Restricting those grants is still worth a separate least-privilege review. The pre-existing rls_auto_enable function was not changed.

### Trigger verification

```sql
CREATE TRIGGER auth_user_profile_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION create_disabled_profile();
CREATE TRIGGER enquiries_touch_updated_at BEFORE UPDATE ON public.enquiries FOR EACH ROW EXECUTE FUNCTION touch_enquiry_updated_at();
CREATE TRIGGER enquiry_created_events AFTER INSERT ON public.enquiries FOR EACH ROW EXECUTE FUNCTION on_enquiry_created();
```

Auth fixture inserts produced four profiles automatically, demonstrating auth_user_profile_created execution. Two enquiry fixture inserts produced two ENQUIRY_CREATED activity rows, two email-outbox rows and four administrator notifications; the test added two more staff notifications, yielding six. All were inside the rolled-back transaction. The updated_at trigger definition/enabled state was inspected; this suite does not separately assert its timestamp behavior.

## Hosted pgTAP execution and errors

The original suite was reviewed before execution: BEGIN/ROLLBACK, four synthetic Auth users, synthetic products/enquiries/notes/notifications/activity, local role/JWT changes, 21 assertions, finish(), no COMMIT, and no external email calls. It supplies enquiry codes directly and does not advance the enquiry-number sequence. No real admin/customer data was used.

1. Docker initially required starting; engine 29.9.3 became available.
2. The supported `test db --remote=fszrsispjxunckknphaw --yes` runner failed before any assertion. CLI exit 1; container exit 1; test process exit 3. Exact relevant output:

```text
/Vision Tech/supabase/tests/001_rls_security_test.sql .. 
Dubious, test returned 3 (wstat 768, 0x300)
No subtests run 

Test Summary Report
-------------------
/Vision Tech/supabase/tests/001_rls_security_test.sql (Wstat: 768 (exited 3) Tests: 0 Failed: 0)
  Non-zero exit status: 3
  Parse errors: No plan found in TAP output
Files=1, Tests=0,  4 wallclock secs ( 0.00 usr +  0.01 sys =  0.01 CPU)
Result: FAIL

Target: project VisionTech-Staging (fszrsispjxunckknphaw) Â· production
Initialising login role...
Confirmed by --yes: Run pgTAP tests on project VisionTech-Staging (fszrsispjxunckknphaw) Â· production
psql:/Vision Tech/supabase/tests/001_rls_security_test.sql:4: NOTICE:  extension "pgtap" already exists, skipping
psql:/Vision Tech/supabase/tests/001_rls_security_test.sql:6: ERROR:  permission denied for schema extensions
LINE 1: select extensions.plan(21);
               ^
error running container: exit 1
```

No permissions were changed to work around this runner failure. A read-only check confirmed no test data and no retained pgTAP extension.

3. The attempt to run the unchanged file through `db query` was initially not executed because automatic approval review hit a usage limit; it was retried normally after the user asked to continue. The unchanged suite then executed successfully through the supported SQL query interface, exit 0, but that interface returned only the last nonempty result (`ok 21`). This alone was not accepted as evidence of all assertions passing.
4. An external temporary copy captures each original plan/assertion/finish SELECT into a transaction-local result table, without changing assertion expressions or fixtures. It grants INSERT/SELECT only on that temporary output table to test roles, resets the role for the final aggregate SELECT, and retains ROLLBACK. It creates no persistent harness object or grant. The original test file remains unchanged, SHA-256 `10ebb7fe047c7109b7c19dd7dc3372e12c4d6847ea6a4215e2203b38aed9df45`.

Successful capture command (cached CLI executable is the npx-installed CLI 3.1.0):

```powershell
supabase.exe db query --remote=fszrsispjxunckknphaw --yes --file "C:\Users\LEGION\Documents\Codex\2026-11-13\p0-02b-disposable-local-supabase-migration\p005-pgtap-capture.sql"
```

Exit **0**. Observed results: **21 passed, 0 failed, 0 skipped, 0 unexecuted**. The following are the actual returned TAP lines:

```text
1..21
ok 1 - anonymous can read published products only
ok 2 - anonymous cannot read profiles
ok 3 - anonymous cannot read enquiries
ok 4 - anonymous cannot read private notes
ok 5 - anonymous cannot read activity
ok 6 - anonymous cannot read notifications
ok 7 - anonymous cannot read email outbox
ok 8 - staff sees assigned enquiry only
ok 9 - staff sees notes for assigned enquiry only
ok 10 - staff sees own notifications only
ok 11 - staff sees assigned enquiry event and own actor event only
ok 12 - staff cannot modify profile role directly
ok 13 - staff cannot update product records
ok 14 - admin can read all enquiries
ok 15 - admin can read hidden and published products
ok 16 - admin can update product data through the authorized RPC
ok 17 - anonymous role cannot execute staff administration RPC
ok 18 - authenticated role cannot execute service-only staff administration RPC
ok 19 - admin cannot elevate a staff account
ok 20 - failed admin escalation leaves the staff role unchanged
ok 21 - super administrator can grant an administrator role
```

The stale activity-count expectation was not changed in this task: it already expected two rows, reflecting the enquiry-created event plus the actor's own event. Assertion 11 passed with that existing expectation. No assertion was weakened or removed.

## Cleanup verification

Read-only counts after the failed runner and after successful tests match the pre-test state:

| Object | Before tests | After tests |
| --- | --- | --- |

| admin_activity | 0 | 0 |

| admin_notifications | 0 | 0 |

| auth_users | 0 | 0 |

| email_outbox | 0 | 0 |

| enquiries | 0 | 0 |

| enquiry_notes | 0 | 0 |

| pgtap_installed | False | False |

| products | 0 | 0 |

| profiles | 0 | 0 |

| service_content | 0 | 0 |

| site_settings | 1 | 1 |

| storage_buckets | 0 | 0 |

| storage_objects | 0 | 0 |

| submission_rate_limits | 0 | 0 |

There are zero retained Auth users, profiles, products, enquiries, notes, notifications, activity rows or outbox records. The one site_settings row is the migration seed, not a test fixture. pgTAP is not retained. No cleanup DELETE, DROP or remote reset was needed. The temporary capture table was transaction-local and rolled back; unchanged public catalog snapshots confirm no persistent harness objects. Local evidence/harness files are retained outside the repository for reproducibility, not claimed deleted.

## Security findings and remaining limits

- **Follow-up required: sequence privileges.** `enquiry_number_seq` has SELECT/UPDATE/USAGE for anon and authenticated, as well as service_role. Current hosted default sequence ACLs for postgres/public contain the same grants. The migration grants service_role access but does not revoke client-role sequence privileges. This is consistent with inherited defaults rather than a failed migration; it is broader than least privilege and is not covered by the 21 assertions. No sequence-manipulation attack was attempted. Assess exposure and add a separate reviewed hardening migration/test before production; do not edit historical migrations. No permission repair was applied here.
- Table ACLs match intended restrictions: anon SELECT only on products/service_content; authenticated SELECT on authorized application tables, UPDATE only of notification read_at; submission_rate_limits is service-only. RLS further restricts rows. Service-role privileges remain privileged by design.
- Some existing self/assigned-record policy branches do not explicitly require ACTIVE account state (notably profile-self, assigned notes and activity). Current tests cover active role isolation, not a complete disabled-account matrix. Review this before account activation/production use.
- Broad trigger-function grants and hosted default privileges warrant a least-privilege follow-up, without modifying the already-deployed migration files.
- No real admin account/login, public HTTP enquiry flow, email delivery, browser functionality, load/performance or full managed-schema audit was tested here. SQL outbox insertion is not evidence of an email being sent.
- Recovery remains the accepted Condition B, not a tested full backup restore. Once real data exists, obtain and restore-test an appropriate backup before subsequent deployments.
- The standard Docker pgTAP runner permission problem remains a tooling issue; the SQL query capture method provides actual hosted assertion evidence without permanent grants.

## Git and secret handling

.env is ignored and untracked. No credential values were printed or copied into reports. No original migration, test SQL, .env, website source, production configuration or account was modified. Only this project report was updated by this milestone's documentation step. External scratch SQL/JSON evidence contains schema/aggregate/synthetic test data, not credentials. No commit or push occurred. Git also lists two pre-existing untracked readiness/recovery reports; these were preserved.

## Verification queries and evidence

All catalog/count/ACL queries below were run with `db query --remote=fszrsispjxunckknphaw --read-only --file ...`. They returned exit 0. The transactional security test was the only post-deployment fixture operation and used --yes under the existing explicit authorization. Evidence timestamps are recorded in their JSON wrappers (UTC).

External evidence directory:

```text
C:\Users\LEGION\Documents\Codex\2026-11-13\p0-02b-disposable-local-supabase-migration
```

Files: p005-stage1-current.json; p005-post-ledger.json; p005-post-catalog.json; p005-before-tests.json; p005-pgtap.json; p005-after-runner.json; p005-pgtap-query.json; p005-pgtap-captured.json; p005-final-counts.json; p005-final-catalog.json; p005-final-extra.json; p005-acls.json; p005-default-acls.json. External p005-pgtap-capture.sql preserves the output harness for review.

### Catalog

```sql
-- Read-only catalog snapshot. Suitable for the confirmed staging SQL Editor.
-- No customer data, function calls that mutate state, or DDL/DML.
SELECT jsonb_build_object(
  'database', current_database(),
  'current_user', current_user,
  'read_only', current_setting('transaction_read_only'),
  'server_version', current_setting('server_version'),
  'history_schema', to_regnamespace('supabase_migrations')::text,
  'history_relation', to_regclass('supabase_migrations.schema_migrations')::text,
  'history_named_relations', (SELECT coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'kind',c.relkind) ORDER BY n.nspname,c.relname),'[]'::jsonb) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relname IN ('schema_migrations','migrations')),
  'public_relations', (SELECT coalesce(jsonb_agg(jsonb_build_object('name',c.relname,'kind',c.relkind,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity) ORDER BY c.relname),'[]'::jsonb) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S')),
  'columns', (SELECT coalesce(jsonb_agg(jsonb_build_object('table',c.relname,'name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid)) ORDER BY c.relname,a.attnum),'[]'::jsonb) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE n.nspname='public' AND c.relkind IN ('r','p') AND a.attnum>0 AND NOT a.attisdropped),
  'constraints', (SELECT coalesce(jsonb_agg(jsonb_build_object('table',c.conrelid::regclass::text,'name',c.conname,'type',c.contype,'definition',pg_get_constraintdef(c.oid)) ORDER BY c.conname),'[]'::jsonb) FROM pg_constraint c WHERE c.connamespace='public'::regnamespace),
  'indexes', (SELECT coalesce(jsonb_agg(jsonb_build_object('table',tablename,'name',indexname,'definition',indexdef) ORDER BY tablename,indexname),'[]'::jsonb) FROM pg_indexes WHERE schemaname='public'),
  'policies', (SELECT coalesce(jsonb_agg(jsonb_build_object('table',tablename,'name',policyname,'roles',roles,'command',cmd,'using',qual,'check',with_check) ORDER BY tablename,policyname),'[]'::jsonb) FROM pg_policies WHERE schemaname='public'),
  'functions', (SELECT coalesce(jsonb_agg(jsonb_build_object('name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),'security_definer',p.prosecdef,'settings',p.proconfig,'acl',p.proacl::text,'body_md5',md5(p.prosrc),'anon_execute',has_function_privilege('anon',p.oid,'EXECUTE'),'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE'),'service_execute',has_function_privilege('service_role',p.oid,'EXECUTE')) ORDER BY p.proname),'[]'::jsonb) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'),
  'triggers', (SELECT coalesce(jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid)) ORDER BY n.nspname,c.relname,t.tgname),'[]'::jsonb) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE NOT t.tgisinternal AND (n.nspname='public' OR (n.nspname='auth' AND c.relname='users'))),
  'enums', (SELECT coalesce(jsonb_agg(jsonb_build_object('name',t.typname,'label',e.enumlabel,'order',e.enumsortorder) ORDER BY t.typname,e.enumsortorder),'[]'::jsonb) FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace JOIN pg_enum e ON e.enumtypid=t.oid WHERE n.nspname='public'),
  'extensions', (SELECT coalesce(jsonb_agg(jsonb_build_object('name',e.extname,'version',e.extversion,'schema',n.nspname) ORDER BY e.extname),'[]'::jsonb) FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace),
  'table_grants', (SELECT coalesce(jsonb_agg(jsonb_build_object('table',table_name,'grantee',grantee,'privilege',privilege_type) ORDER BY table_name,grantee,privilege_type),'[]'::jsonb) FROM information_schema.table_privileges WHERE table_schema='public')
) AS catalog;

-- Run this separate query ONLY if history_relation above is not null:
-- SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;
```

### Data/extension cleanup counts

```sql
select jsonb_build_object('profiles', (select count(*) from public.profiles),'products', (select count(*) from public.products),'enquiries', (select count(*) from public.enquiries),'enquiry_notes', (select count(*) from public.enquiry_notes),'admin_notifications', (select count(*) from public.admin_notifications),'admin_activity', (select count(*) from public.admin_activity),'email_outbox', (select count(*) from public.email_outbox),'service_content', (select count(*) from public.service_content),'site_settings', (select count(*) from public.site_settings),'submission_rate_limits', (select count(*) from public.submission_rate_limits),'auth_users', (select count(*) from auth.users),'storage_buckets', (select count(*) from storage.buckets),'storage_objects', (select count(*) from storage.objects),'pgtap_installed',exists(select 1 from pg_extension where extname='pgtap')) as counts;
```

### Ledger, managed event triggers and validity

```sql
select jsonb_build_object('ledger',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations),'events',(select jsonb_agg(jsonb_build_object('name',evtname,'event',evtevent,'enabled',evtenabled,'function',evtfoid::regproc::text) order by evtname) from pg_event_trigger),'anon_public_create',has_schema_privilege('anon','public','CREATE'),'authenticated_public_create',has_schema_privilege('authenticated','public','CREATE'),'invalid_indexes',(select count(*) from pg_index i join pg_class c on c.oid=i.indexrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not i.indisvalid),'unvalidated_constraints',(select count(*) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public' and not c.convalidated)) as final_checks;
```

### Table and sequence ACLs

```sql
select c.relname, c.relkind, c.relacl::text as acl, (select jsonb_agg(jsonb_build_object('column',a.attname,'acl',a.attacl::text)) from pg_attribute a where a.attrelid=c.oid and a.attacl is not null) as column_acl from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','S') order by c.relname;
```

### Default ACL query

```sql
select r.rolname as owner, n.nspname as schema, d.defaclobjtype as type, d.defaclacl::text as acl from pg_default_acl d join pg_roles r on r.oid=d.defaclrole left join pg_namespace n on n.oid=d.defaclnamespace where n.nspname='public' or d.defaclnamespace=0 order by owner,schema,type;
```

## Final decision

**STAGING MIGRATIONS DEPLOYED AND VERIFIED.** Existing hosted security suite: **21/21 passed**, fixtures removed by rollback and verified absent. Stop here: no website deployment or further database changes. Address the documented sequence/default-privilege and disabled-account coverage findings in a separately reviewed hardening milestone before claiming production security readiness.
