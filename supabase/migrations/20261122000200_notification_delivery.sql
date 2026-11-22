-- Prompt 10. Apply only after owner review. Existing customer and audit data are retained.
alter table public.admin_notifications add column staff_id uuid references public.profiles(id) on delete set null;
create index notifications_history_idx on public.admin_notifications(recipient_id,created_at desc,id desc);

-- One job per operational inbox event or legacy new-enquiry outbox row.
create table public.notification_delivery (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid unique references public.admin_notifications(id) on delete cascade,
  outbox_id uuid unique references public.email_outbox(id) on delete cascade,
  state text not null default 'PENDING' check (state in ('PENDING','ACCEPTED','SKIPPED','REVIEW')),
  attempts integer not null default 0,
  next_attempt timestamptz not null default now(),
  lease uuid, first_send timestamptz, fingerprint text, provider_id text, last_error text,
  check (num_nonnulls(notification_id,outbox_id)=1)
);
alter table public.notification_delivery enable row level security;
revoke all on public.notification_delivery from public, anon, authenticated;
grant select, insert, update, delete on public.notification_delivery to service_role;
create index notification_delivery_due_idx on public.notification_delivery(next_attempt,id) where state='PENDING';

create function public.enqueue_notification_delivery() returns trigger
language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
begin
  if tg_table_name='email_outbox' then
    insert into public.notification_delivery(outbox_id) values(new.id) on conflict do nothing;
  elsif new.kind in ('ENQUIRY_ASSIGNED','ENQUIRY_REASSIGNED','ENQUIRY_CONVERTED','ENQUIRY_CLOSED','STAFF_ACCESS_CHANGED') then
    insert into public.notification_delivery(notification_id) values(new.id) on conflict do nothing;
  end if;
  return new;
end $$;
create trigger queue_new_enquiry after insert on public.email_outbox
for each row execute function public.enqueue_notification_delivery();
create trigger queue_operational_notification after insert on public.admin_notifications
for each row execute function public.enqueue_notification_delivery();

-- Old unconfirmed deliveries require review before replaying outside the provider's retry window.
insert into public.notification_delivery(outbox_id,state,last_error)
select id,'REVIEW','Historical delivery requires reconciliation' from public.email_outbox where status <> 'SENT';

create or replace function public.admin_assign_enquiry(p_enquiry_id uuid,p_assignee uuid)
returns public.enquiries language plpgsql security definer set search_path = pg_catalog, public, auth, pg_temp as $$
declare previous uuid; result public.enquiries;
begin
  if coalesce(public.current_admin_role(),'') not in ('SUPER_ADMIN','ADMIN') then raise exception 'Forbidden'; end if;
  if p_assignee is not null then
    perform 1 from public.profiles where id=p_assignee and account_state='ACTIVE' for share;
    if not found then raise exception 'Assignee is not active'; end if;
  end if;
  select * into result from public.enquiries where id=p_enquiry_id for update;
  if not found then raise exception 'Enquiry not found'; end if;
  previous := result.assigned_to;
  if previous is not distinct from p_assignee then return result; end if;
  update public.enquiries set assigned_to=p_assignee where id=p_enquiry_id returning * into result;
  insert into public.admin_activity(actor_id,action,entity_type,entity_id,details)
  values(auth.uid(),'ENQUIRY_ASSIGNED','ENQUIRY',p_enquiry_id,jsonb_build_object('assignedTo',p_assignee));
  if p_assignee is not null then
    insert into public.admin_notifications(recipient_id,enquiry_id,kind,title)
    values(p_assignee,p_enquiry_id,case when previous is null then 'ENQUIRY_ASSIGNED' else 'ENQUIRY_REASSIGNED' end,'An enquiry was assigned to you');
  end if;
  return result;
end $$;

create function public.notify_operational_change() returns trigger
language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
begin
  if tg_table_name='enquiries' then
    insert into public.admin_notifications(recipient_id,enquiry_id,kind,title)
    select p.id,new.id,'ENQUIRY_' || new.status::text,'An enquiry was ' || lower(new.status::text)
    from public.profiles p where p.account_state='ACTIVE' and
      (p.role in ('ADMIN','SUPER_ADMIN') or p.id=new.assigned_to);
  else
    insert into public.admin_notifications(recipient_id,staff_id,kind,title)
    select p.id,new.id,'STAFF_ACCESS_CHANGED','Staff role or account status changed'
    from public.profiles p where p.account_state='ACTIVE' and
      (p.role='SUPER_ADMIN' or (p.role='ADMIN' and new.role='STAFF'));
  end if;
  return new;
end $$;
create trigger notify_enquiry_outcome after update of status on public.enquiries
for each row when (old.status is distinct from new.status and new.status in ('CONVERTED','CLOSED'))
execute function public.notify_operational_change();
create trigger notify_staff_access after update of role,account_state on public.profiles
for each row when (old.role is distinct from new.role or old.account_state is distinct from new.account_state)
execute function public.notify_operational_change();

create function public.claim_notification_delivery(p_outbox uuid default null)
returns setof public.notification_delivery language sql security definer set search_path = pg_catalog, public, pg_temp as $$
  update public.notification_delivery q set lease=gen_random_uuid(),next_attempt=now()+interval '2 minutes',attempts=attempts+1
  where q.id=(select d.id from public.notification_delivery d where state='PENDING'
    and (p_outbox is null or d.outbox_id=p_outbox)
    and (next_attempt<=now() or (p_outbox is not null and lease is null))
    order by next_attempt,id for update skip locked limit 1) returning q.*;
$$;
create function public.reflect_notification_delivery() returns trigger
language plpgsql security definer set search_path = pg_catalog, public, pg_temp as $$
begin
  update public.email_outbox set status=case when new.state='ACCEPTED' then 'SENT' else 'FAILED' end,
    provider_message_id=new.provider_id,attempts=new.attempts,last_error=new.last_error,updated_at=now(),
    sent_at=case when new.state='ACCEPTED' then now() else null end where id=new.outbox_id;
  return new;
end $$;
create trigger reflect_new_enquiry_delivery after update on public.notification_delivery
for each row when (new.outbox_id is not null and old.lease is not null and new.lease is null)
execute function public.reflect_notification_delivery();
revoke all on function public.enqueue_notification_delivery(),public.notify_operational_change(),public.reflect_notification_delivery(),public.claim_notification_delivery(uuid) from public,anon,authenticated;
grant execute on function public.claim_notification_delivery(uuid) to service_role;
-- Reminders appear once for the current assignee and scheduled due time.
alter table public.admin_notifications add column reminder_for timestamptz;
create unique index notification_followup_once on public.admin_notifications(recipient_id,enquiry_id,reminder_for)
  where reminder_for is not null;
create function public.enqueue_due_followups() returns void
language sql security definer set search_path = pg_catalog, public, pg_temp as $$
  insert into public.admin_notifications(recipient_id,enquiry_id,reminder_for,kind,title)
  select e.assigned_to,e.id,e.follow_up_at,'FOLLOW_UP_DUE','An assigned enquiry is due for follow-up'
  from public.enquiries e join public.profiles p on p.id=e.assigned_to
  where p.account_state='ACTIVE' and e.follow_up_at<=now() and e.status not in ('CLOSED','CONVERTED')
  and not exists(select 1 from public.admin_notifications n where n.recipient_id=e.assigned_to and n.enquiry_id=e.id and n.reminder_for=e.follow_up_at)
  order by e.follow_up_at,e.id limit 100 on conflict do nothing;
$$;
revoke all on function public.enqueue_due_followups() from public,anon,authenticated;
grant execute on function public.enqueue_due_followups() to service_role;

