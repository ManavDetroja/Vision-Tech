-- Run on an isolated local Supabase database. All fixtures roll back.
begin;
create extension if not exists pgtap with schema extensions;
select extensions.plan(9);

insert into auth.users(id,email) values
  ('a0000000-1111-4000-8000-000000000001','notification-admin@example.invalid'),
  ('a0000000-1111-4000-8000-000000000002','notification-assignee@example.invalid');
update public.profiles set role='ADMIN',account_state='ACTIVE' where id='a0000000-1111-4000-8000-000000000001';
update public.profiles set account_state='ACTIVE' where id='a0000000-1111-4000-8000-000000000002';

insert into public.enquiries(id,enquiry_code,idempotency_key,customer_name,customer_email,customer_phone,enquiry_type,customer_message,consented_at)
values ('b0000000-1111-4000-8000-000000000001','P10-TAP',gen_random_uuid(),'Disposable notification fixture','','0000000000','GENERAL_ENQUIRY','Local reminder test',now());
select extensions.is((select count(*) from public.notification_delivery d join public.email_outbox b on d.outbox_id=b.id
  where b.enquiry_id='b0000000-1111-4000-8000-000000000001'),1::bigint,'one durable new-enquiry job');

set local role authenticated;
select set_config('request.jwt.claim.sub','a0000000-1111-4000-8000-000000000001',true);
select id from public.admin_assign_enquiry('b0000000-1111-4000-8000-000000000001','a0000000-1111-4000-8000-000000000002');
select id from public.admin_assign_enquiry('b0000000-1111-4000-8000-000000000001','a0000000-1111-4000-8000-000000000002');
select extensions.is((select count(*) from public.admin_notifications where kind='ENQUIRY_ASSIGNED'
  and enquiry_id='b0000000-1111-4000-8000-000000000001'),0::bigint,'administrator cannot read assignee inbox entry');
select extensions.ok(not has_function_privilege(current_user,'public.claim_notification_delivery(uuid)','EXECUTE'),'authenticated accounts cannot claim mail');
select extensions.ok(not has_table_privilege(current_user,'public.notification_delivery','SELECT'),'authenticated accounts cannot inspect mail queue');

select set_config('request.jwt.claim.sub','a0000000-1111-4000-8000-000000000002',true);
select extensions.is((select count(*) from public.admin_notifications where kind='ENQUIRY_ASSIGNED'
  and enquiry_id='b0000000-1111-4000-8000-000000000001'),1::bigint,'repeating assignment produces one inbox entry');
reset role;
update public.enquiries set follow_up_at=now()-interval '1 minute' where id='b0000000-1111-4000-8000-000000000001';
select public.enqueue_due_followups();
select public.enqueue_due_followups();
select extensions.is((select count(*) from public.admin_notifications where enquiry_id='b0000000-1111-4000-8000-000000000001'
  and kind='FOLLOW_UP_DUE'),1::bigint,'repeated scheduler ticks create one reminder');
select extensions.is((select count(*) from public.notification_delivery d join public.admin_notifications n on n.id=d.notification_id
  where n.enquiry_id='b0000000-1111-4000-8000-000000000001' and n.kind='FOLLOW_UP_DUE'),0::bigint,'reminders stay in the private inbox');
select extensions.is((select count(*) from public.notification_delivery d join public.admin_notifications n on n.id=d.notification_id
  where n.enquiry_id='b0000000-1111-4000-8000-000000000001' and n.kind='ENQUIRY_ASSIGNED'),1::bigint,'assignment mail queued once');

update public.profiles set account_state='DISABLED' where id='a0000000-1111-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub','a0000000-1111-4000-8000-000000000002',true);
select extensions.is((select count(*) from public.admin_notifications),0::bigint,'disabled account loses access to its inbox history');
select * from extensions.finish();
rollback;
