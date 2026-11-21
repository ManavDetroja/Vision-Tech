-- Local disposable fixtures only. Runner injects the pending migration after BEGIN.
begin;
-- PENDING_MIGRATION_UNDER_TEST
create extension if not exists pgtap with schema extensions;
select extensions.plan(12);
insert into auth.users(id,email) values
 ('71000000-0000-4000-8000-000000000001','staff7-super@example.invalid'),
 ('71000000-0000-4000-8000-000000000002','staff7-admin@example.invalid'),
 ('71000000-0000-4000-8000-000000000003','staff7-worker@example.invalid');
update public.profiles set role='SUPER_ADMIN',account_state='ACTIVE' where id='71000000-0000-4000-8000-000000000001';
update public.profiles set role='ADMIN',account_state='ACTIVE' where id='71000000-0000-4000-8000-000000000002';
update public.profiles set account_state='ACTIVE' where id='71000000-0000-4000-8000-000000000003';
insert into public.admin_activity(actor_id,action,entity_type) values ('71000000-0000-4000-8000-000000000003','LOCAL_TEST','STAFF');
set local role authenticated;
select set_config('request.jwt.claim.sub','71000000-0000-4000-8000-000000000003',true);
select extensions.is((select count(*)::integer from public.admin_activity where action='LOCAL_TEST'),1,'active staff can read own activity');
select extensions.throws_ok($$select public.admin_set_staff(auth.uid(),auth.uid(),'SUPER_ADMIN','ACTIVE','Synthetic','synthetic@example.invalid')$$,'42501',null,'direct authenticated staff administration is denied');
reset role;
update public.profiles set account_state='DISABLED' where id='71000000-0000-4000-8000-000000000003';
set local role authenticated;
select extensions.is((select count(*)::integer from public.admin_activity where action='LOCAL_TEST'),0,'disabled staff cannot read old private activity');
select extensions.is(public.current_admin_role(),null::text,'disabled profile has no operational role');
reset role;
set local role service_role;
select extensions.throws_ok($$select public.admin_set_staff('71000000-0000-4000-8000-000000000002','71000000-0000-4000-8000-000000000003','ADMIN','ACTIVE','Synthetic','synthetic@example.invalid')$$,'P0001',null,'ADMIN cannot promote STAFF');
select extensions.throws_ok($$select public.admin_set_staff('71000000-0000-4000-8000-000000000002','71000000-0000-4000-8000-000000000002','STAFF','ACTIVE','Synthetic','synthetic@example.invalid')$$,'P0001',null,'ADMIN cannot edit self');
select extensions.throws_ok($$select public.admin_set_staff('71000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001','STAFF','DISABLED','Synthetic','synthetic@example.invalid')$$,'P0001',null,'last SUPER_ADMIN is protected');
select extensions.lives_ok($$select public.admin_set_staff('71000000-0000-4000-8000-000000000002','71000000-0000-4000-8000-000000000003','STAFF','ACTIVE','Synthetic','synthetic@example.invalid')$$,'ADMIN can activate STAFF');
select extensions.is((select account_state::text from public.profiles where id='71000000-0000-4000-8000-000000000003'),'ACTIVE','activation persisted');
select extensions.lives_ok($$select public.admin_set_staff('71000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000003','ADMIN','ACTIVE','Synthetic','synthetic@example.invalid')$$,'SUPER_ADMIN can promote STAFF to ADMIN');
select extensions.is((select count(*)::integer from public.admin_activity where entity_id='71000000-0000-4000-8000-000000000003' and action='STAFF_SETTINGS_CHANGED'),2,'successful changes audited transactionally');
select extensions.ok((select relrowsecurity from pg_class where oid='public.admin_activity'::regclass),'activity RLS remains enabled');
select * from extensions.finish();
rollback;
