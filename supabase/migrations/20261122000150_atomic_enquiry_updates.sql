create or replace function public.admin_update_enquiry_status(
  p_enquiry_id uuid, p_status text
) returns public.enquiries
language plpgsql security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_row public.enquiries;
begin
  select p.role::text into v_role
    from public.profiles p
    where p.id = v_actor and p.account_state = 'ACTIVE'
    for share;
  if v_role is null or p_status is null
     or p_status not in ('NEW','CONTACTED','IN_PROGRESS','CONVERTED','CLOSED') then
    raise exception 'Forbidden or invalid status';
  end if;

  update public.enquiries as e
     set status = p_status::public.enquiry_status,
         converted_at = case when p_status = 'CONVERTED' then coalesce(e.converted_at, now()) else e.converted_at end,
         closed_at = case when p_status = 'CLOSED' then coalesce(e.closed_at, now()) else e.closed_at end,
         resolved_at = case when p_status = 'CLOSED' then coalesce(e.resolved_at, now()) else e.resolved_at end
   where e.id = p_enquiry_id
     and (v_role in ('SUPER_ADMIN','ADMIN') or (v_role = 'STAFF' and e.assigned_to = v_actor))
   returning e.* into v_row;
  if not found then
    if v_role = 'STAFF' then raise exception 'Forbidden'; end if;
    raise exception 'Enquiry not found';
  end if;
  insert into public.admin_activity(actor_id,action,entity_type,entity_id,details)
    values(v_actor,'ENQUIRY_STATUS_CHANGED','ENQUIRY',p_enquiry_id,jsonb_build_object('status',p_status));
  return v_row;
end;
$$;

create or replace function public.admin_set_enquiry_follow_up(
  p_enquiry_id uuid, p_follow_up_at timestamptz
) returns public.enquiries
language plpgsql security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_row public.enquiries;
begin
  select p.role::text into v_role
    from public.profiles p
    where p.id = v_actor and p.account_state = 'ACTIVE'
    for share;
  if v_role is null then raise exception 'Forbidden'; end if;

  update public.enquiries as e
     set follow_up_at = p_follow_up_at
   where e.id = p_enquiry_id
     and (v_role in ('SUPER_ADMIN','ADMIN') or (v_role = 'STAFF' and e.assigned_to = v_actor))
   returning e.* into v_row;
  if not found then
    if v_role = 'STAFF' then raise exception 'Forbidden'; end if;
    raise exception 'Enquiry not found';
  end if;
  insert into public.admin_activity(actor_id,action,entity_type,entity_id,details)
    values(v_actor,'ENQUIRY_FOLLOW_UP_CHANGED','ENQUIRY',p_enquiry_id,jsonb_build_object('followUpAt',p_follow_up_at));
  return v_row;
end;
$$;
