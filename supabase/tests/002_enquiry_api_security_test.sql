-- Run on the disposable LOCAL stack after the two draft migrations.
-- No Auth users; all fixture data is rolled back. Local sequence gaps are normal.
begin;
create extension if not exists pgtap with schema extensions;
select extensions.plan(18);

set local role anon;
select extensions.throws_ok($$select nextval('public.enquiry_number_seq')$$, '42501', null, 'anon cannot advance sequence');
select extensions.throws_ok($$select setval('public.enquiry_number_seq', 999)$$, '42501', null, 'anon cannot modify sequence');
select extensions.throws_ok($$select last_value from public.enquiry_number_seq$$, '42501', null, 'anon cannot read sequence');
set local role authenticated;
select extensions.throws_ok($$select nextval('public.enquiry_number_seq')$$, '42501', null, 'authenticated cannot advance sequence');
select extensions.throws_ok($$select setval('public.enquiry_number_seq', 999)$$, '42501', null, 'authenticated cannot modify sequence');
select extensions.throws_ok($$select last_value from public.enquiry_number_seq$$, '42501', null, 'authenticated cannot read sequence');
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select extensions.throws_ok($$select nextval('public.enquiry_number_seq')$$, '42501', null, 'backend cannot directly advance sequence');
select extensions.throws_ok($$select setval('public.enquiry_number_seq', 999)$$, '42501', null, 'backend cannot directly modify sequence');
select extensions.throws_ok($$select last_value from public.enquiry_number_seq$$, '42501', null, 'backend cannot directly read sequence');
select extensions.lives_ok($$
  select public.submit_public_enquiry('{"name":"Synthetic API","phone":"9000000000","enquiryType":"general","message":"Synthetic local enquiry without email.","consent":true}'::jsonb,
    '51000000-0000-4000-8000-000000000001', repeat('a',64))
$$, 'service RPC creates enquiry through owner sequence privileges');
select extensions.is((select customer_email from public.enquiries where idempotency_key='51000000-0000-4000-8000-000000000001'), '', 'absent email stored as empty text');
select extensions.is((select status::text from public.enquiries where idempotency_key='51000000-0000-4000-8000-000000000001'), 'NEW', 'new status preserved');
select extensions.is((select count(*)::integer from public.email_outbox), 1, 'transaction created outbox');
select public.submit_public_enquiry('{"name":"Synthetic API","phone":"9000000000","enquiryType":"general","message":"Synthetic local enquiry without email.","consent":true}',
    '51000000-0000-4000-8000-000000000001', repeat('a',64));
select extensions.is((select count(*)::integer from public.enquiries), 1, 'idempotent retry created no duplicate');
select extensions.throws_ok($$
  select public.submit_public_enquiry('{"name":"Synthetic API","email":"bad","phone":"9000000000","enquiryType":"general","message":"Synthetic local invalid email test.","consent":true}',
    '51000000-0000-4000-8000-000000000002', repeat('a',64))
$$, 'P0001', 'Invalid email', 'supplied invalid email still rejected in database');
select extensions.ok((select bool_and(relrowsecurity) from pg_class where oid in ('public.enquiries'::regclass,'public.email_outbox'::regclass)), 'RLS preserved');
select extensions.ok(not has_function_privilege('anon','public.submit_public_enquiry(jsonb,uuid,text)','EXECUTE'), 'anonymous still cannot execute service RPC');
select extensions.ok(not has_function_privilege('authenticated','public.submit_public_enquiry(jsonb,uuid,text)','EXECUTE'), 'authenticated still cannot execute service RPC');

select * from extensions.finish();
rollback;
