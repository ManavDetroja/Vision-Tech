-- Extend the existing VisionTech schema with the requested enquiry lifecycle.
-- Apply after 202611120001_secure_admin.sql to a dedicated Supabase project.

do $$
begin
  if exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'enquiry_status' and e.enumlabel = 'RESOLVED'
  ) and not exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'enquiry_status' and e.enumlabel = 'CLOSED'
  ) then
    alter type public.enquiry_status rename value 'RESOLVED' to 'CLOSED';
  end if;
end $$;

alter type public.enquiry_status add value if not exists 'CONVERTED';

alter table public.enquiries
  add column if not exists converted_at timestamptz,
  add column if not exists closed_at timestamptz,
  add column if not exists follow_up_at timestamptz;

update public.enquiries
set closed_at = coalesce(closed_at, resolved_at)
where status = 'CLOSED' and closed_at is null;

create index if not exists enquiries_follow_up_idx
  on public.enquiries (follow_up_at) where follow_up_at is not null;

-- Permit authorized administrators to manage normal staff accounts while
-- keeping the bootstrap SUPER_ADMIN account outside the editable target set.
create or replace function public.admin_set_staff(p_actor uuid, p_target uuid, p_role text, p_state text, p_name text, p_email text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = p_actor and role in ('SUPER_ADMIN', 'ADMIN') and account_state = 'ACTIVE') then
    raise exception 'Forbidden';
  end if;
  if p_role not in ('ADMIN', 'STAFF') or p_state not in ('ACTIVE', 'DISABLED') then
    raise exception 'Invalid staff settings';
  end if;
  if exists (select 1 from public.profiles where id = p_target and role = 'SUPER_ADMIN') then
    raise exception 'The super administrator account cannot be managed here';
  end if;
  update public.profiles set role = p_role::public.admin_role, account_state = p_state::public.account_state,
    full_name = left(coalesce(p_name, ''), 100), notification_email = lower(left(coalesce(p_email, ''), 254))
  where id = p_target;
  if not found then raise exception 'Staff profile not found'; end if;
  insert into public.admin_activity(actor_id, action, entity_type, entity_id, details)
  values (p_actor, 'STAFF_SETTINGS_CHANGED', 'STAFF', p_target, jsonb_build_object('role', p_role, 'state', p_state));
end;
$$;

create or replace function public.admin_update_enquiry_status(p_enquiry_id uuid, p_status text)
returns public.enquiries language plpgsql security definer set search_path = public, auth
as $$
declare v_role text := public.current_admin_role(); v_row public.enquiries;
begin
  if v_role is null or p_status not in ('NEW', 'CONTACTED', 'IN_PROGRESS', 'CONVERTED', 'CLOSED') then
    raise exception 'Forbidden or invalid status';
  end if;
  if v_role = 'STAFF' and not exists (
    select 1 from public.enquiries where id = p_enquiry_id and assigned_to = auth.uid()
  ) then raise exception 'Forbidden'; end if;

  update public.enquiries set
    status = p_status::public.enquiry_status,
    converted_at = case when p_status = 'CONVERTED' then coalesce(converted_at, now()) else converted_at end,
    closed_at = case when p_status = 'CLOSED' then coalesce(closed_at, now()) else closed_at end,
    resolved_at = case when p_status = 'CLOSED' then coalesce(resolved_at, now()) else resolved_at end
  where id = p_enquiry_id returning * into v_row;
  if not found then raise exception 'Enquiry not found'; end if;

  insert into public.admin_activity(actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'ENQUIRY_STATUS_CHANGED', 'ENQUIRY', p_enquiry_id, jsonb_build_object('status', p_status));
  return v_row;
end;
$$;

create or replace function public.admin_set_enquiry_follow_up(p_enquiry_id uuid, p_follow_up_at timestamptz)
returns public.enquiries language plpgsql security definer set search_path = public, auth
as $$
declare v_role text := public.current_admin_role(); v_row public.enquiries;
begin
  if v_role is null then raise exception 'Forbidden'; end if;
  if v_role = 'STAFF' and not exists (
    select 1 from public.enquiries where id = p_enquiry_id and assigned_to = auth.uid()
  ) then raise exception 'Forbidden'; end if;

  update public.enquiries set follow_up_at = p_follow_up_at
  where id = p_enquiry_id returning * into v_row;
  if not found then raise exception 'Enquiry not found'; end if;

  insert into public.admin_activity(actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'ENQUIRY_FOLLOW_UP_CHANGED', 'ENQUIRY', p_enquiry_id,
    jsonb_build_object('followUpAt', p_follow_up_at));
  return v_row;
end;
$$;

create or replace function public.admin_dashboard_stats()
returns jsonb language plpgsql stable security definer set search_path = public, auth
as $$
declare v_role text := public.current_admin_role();
begin
  if v_role is null then raise exception 'Forbidden'; end if;
  return jsonb_build_object(
    'enquiriesTotal', (select count(*) from public.enquiries where v_role in ('SUPER_ADMIN', 'ADMIN') or assigned_to = auth.uid()),
    'new', (select count(*) from public.enquiries where status = 'NEW' and (v_role in ('SUPER_ADMIN', 'ADMIN') or assigned_to = auth.uid())),
    'contacted', (select count(*) from public.enquiries where status = 'CONTACTED' and (v_role in ('SUPER_ADMIN', 'ADMIN') or assigned_to = auth.uid())),
    'inProgress', (select count(*) from public.enquiries where status = 'IN_PROGRESS' and (v_role in ('SUPER_ADMIN', 'ADMIN') or assigned_to = auth.uid())),
    'converted', (select count(*) from public.enquiries where status = 'CONVERTED' and (v_role in ('SUPER_ADMIN', 'ADMIN') or assigned_to = auth.uid())),
    'closed', (select count(*) from public.enquiries where status = 'CLOSED' and (v_role in ('SUPER_ADMIN', 'ADMIN') or assigned_to = auth.uid())),
    'followUpDue', (select count(*) from public.enquiries where follow_up_at <= now() and status not in ('CONVERTED', 'CLOSED') and (v_role in ('SUPER_ADMIN', 'ADMIN') or assigned_to = auth.uid())),
    'products', case when v_role in ('SUPER_ADMIN', 'ADMIN') then (select count(*) from public.products) else null end,
    'activeStaff', case when v_role in ('SUPER_ADMIN', 'ADMIN') then (select count(*) from public.profiles where account_state = 'ACTIVE') else null end,
    'monthly', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'label', to_char(month_start, 'Mon'),
        'enquiries', (select count(*) from public.enquiries e
          where e.created_at >= month_start and e.created_at < month_start + interval '1 month'
          and (v_role in ('SUPER_ADMIN', 'ADMIN') or e.assigned_to = auth.uid()))
      ) order by month_start), '[]'::jsonb)
      from generate_series(date_trunc('month', now()) - interval '5 months', date_trunc('month', now()), interval '1 month') as months(month_start)
    )
  );
end;
$$;

drop policy if exists activity_read_admin_or_actor on public.admin_activity;
create policy activity_read_admin_or_actor on public.admin_activity for select to authenticated
using (
  public.current_admin_role() in ('SUPER_ADMIN', 'ADMIN')
  or actor_id = auth.uid()
  or (
    entity_type = 'ENQUIRY'
    and exists (
      select 1 from public.enquiries e
      where e.id = admin_activity.entity_id and e.assigned_to = auth.uid()
    )
  )
);

revoke all on function public.admin_set_enquiry_follow_up(uuid, timestamptz) from public, anon;
grant execute on function public.admin_set_enquiry_follow_up(uuid, timestamptz) to authenticated;
revoke all on function public.admin_set_staff(uuid, uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.admin_set_staff(uuid, uuid, text, text, text, text) to service_role;
