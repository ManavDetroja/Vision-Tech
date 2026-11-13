-- pgTAP regression checks for a disposable local/staging database.
-- Fixtures are synthetic and rolled back. Never point this test at production.
begin;
create extension if not exists pgtap with schema extensions;

select extensions.plan(21);

insert into auth.users (id, email) values
  ('10000000-0000-4000-8000-000000000001', 'pgtap-superadmin@example.invalid'),
  ('10000000-0000-4000-8000-000000000002', 'pgtap-admin@example.invalid'),
  ('10000000-0000-4000-8000-000000000003', 'pgtap-staff-a@example.invalid'),
  ('10000000-0000-4000-8000-000000000004', 'pgtap-staff-b@example.invalid');

update public.profiles set role = 'SUPER_ADMIN', account_state = 'ACTIVE' where id = '10000000-0000-4000-8000-000000000001';
update public.profiles set role = 'ADMIN', account_state = 'ACTIVE' where id = '10000000-0000-4000-8000-000000000002';
update public.profiles set role = 'STAFF', account_state = 'ACTIVE' where id in ('10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004');

insert into public.products(id, model, category_id, record, is_visible) values
  ('pgtap-visible', 'P-GTP-001', 'test', '{"id":"pgtap-visible","model":"P-GTP-001","categoryId":"test"}', true),
  ('pgtap-hidden', 'P-GTP-002', 'test', '{"id":"pgtap-hidden","model":"P-GTP-002","categoryId":"test"}', false);

insert into public.enquiries(id, enquiry_code, idempotency_key, customer_name, customer_email,
  customer_phone, enquiry_type, customer_message, consented_at, assigned_to)
values
  ('20000000-0000-4000-8000-000000000001', 'P-GTP-ENQ-001', '30000000-0000-4000-8000-000000000001', 'Synthetic One', 'one@example.invalid', '0000000000', 'GENERAL_ENQUIRY', 'Synthetic test record one', now(), '10000000-0000-4000-8000-000000000003'),
  ('20000000-0000-4000-8000-000000000002', 'P-GTP-ENQ-002', '30000000-0000-4000-8000-000000000002', 'Synthetic Two', 'two@example.invalid', '0000000000', 'GENERAL_ENQUIRY', 'Synthetic test record two', now(), '10000000-0000-4000-8000-000000000004');

insert into public.enquiry_notes(enquiry_id, author_id, note) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'Synthetic private note A'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', 'Synthetic private note B');
insert into public.admin_notifications(recipient_id, enquiry_id, kind, title) values
  ('10000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', 'TEST', 'Synthetic notification A'),
  ('10000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000002', 'TEST', 'Synthetic notification B');
insert into public.admin_activity(actor_id, action, entity_type, entity_id, details) values
  ('10000000-0000-4000-8000-000000000003', 'TEST', 'ENQUIRY', '20000000-0000-4000-8000-000000000001', '{}'),
  ('10000000-0000-4000-8000-000000000004', 'TEST', 'ENQUIRY', '20000000-0000-4000-8000-000000000002', '{}');

set local role anon;
select extensions.is((select count(*)::integer from public.products), 1, 'anonymous can read published products only');
select extensions.throws_ok('select * from public.profiles', '42501', null, 'anonymous cannot read profiles');
select extensions.throws_ok('select * from public.enquiries', '42501', null, 'anonymous cannot read enquiries');
select extensions.throws_ok('select * from public.enquiry_notes', '42501', null, 'anonymous cannot read private notes');
select extensions.throws_ok('select * from public.admin_activity', '42501', null, 'anonymous cannot read activity');
select extensions.throws_ok('select * from public.admin_notifications', '42501', null, 'anonymous cannot read notifications');
select extensions.throws_ok('select * from public.email_outbox', '42501', null, 'anonymous cannot read email outbox');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
select extensions.is((select count(*)::integer from public.enquiries), 1, 'staff sees assigned enquiry only');
select extensions.is((select count(*)::integer from public.enquiry_notes), 1, 'staff sees notes for assigned enquiry only');
select extensions.is((select count(*)::integer from public.admin_notifications), 1, 'staff sees own notifications only');
select extensions.is((select count(*)::integer from public.admin_activity), 1, 'staff sees activity for assigned enquiry only');
select extensions.throws_ok('update public.profiles set role = ''SUPER_ADMIN'' where id = auth.uid()', '42501', null, 'staff cannot modify profile role directly');
select extensions.throws_ok($$select public.admin_update_product('pgtap-visible', '{"summary":"forbidden"}'::jsonb, true)$$, 'P0001', 'Forbidden', 'staff cannot update product records');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select extensions.is((select count(*)::integer from public.enquiries), 2, 'admin can read all enquiries');
select extensions.is((select count(*)::integer from public.products), 2, 'admin can read hidden and published products');
select public.admin_update_product('pgtap-visible', '{"summary":"Synthetic admin edit"}'::jsonb, true);
select extensions.is((select record->>'summary' from public.products where id = 'pgtap-visible'), 'Synthetic admin edit', 'admin can update product data through the authorized RPC');

select extensions.ok(not has_function_privilege('anon', 'public.admin_set_staff(uuid,uuid,text,text,text,text)', 'EXECUTE'), 'anonymous role cannot execute staff administration RPC');
select extensions.ok(not has_function_privilege('authenticated', 'public.admin_set_staff(uuid,uuid,text,text,text,text)', 'EXECUTE'), 'authenticated role cannot execute service-only staff administration RPC');

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select extensions.throws_ok(
  $$select public.admin_set_staff('10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003', 'ADMIN', 'ACTIVE', 'Synthetic Staff A', 'pgtap-staff-a@example.invalid')$$,
  'P0001', 'Only a super administrator may manage administrator accounts', 'admin cannot elevate a staff account'
);
select extensions.is((select role::text from public.profiles where id = '10000000-0000-4000-8000-000000000003'), 'STAFF', 'failed admin escalation leaves the staff role unchanged');
select public.admin_set_staff('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'ADMIN', 'ACTIVE', 'Synthetic Staff A', 'pgtap-staff-a@example.invalid');
select extensions.is((select role::text from public.profiles where id = '10000000-0000-4000-8000-000000000003'), 'ADMIN', 'super administrator can grant an administrator role');

select * from extensions.finish();
rollback;
