-- Additive hardening for the existing admin schema. This migration changes no
-- customer/product data and must be applied only after reviewing remote history.

alter table public.enquiries
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.touch_enquiry_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists enquiries_touch_updated_at on public.enquiries;
create trigger enquiries_touch_updated_at
before update on public.enquiries
for each row execute function public.touch_enquiry_updated_at();

-- Elevation is restricted in both the trusted API layer and this database RPC.
-- ADMIN may manage STAFF records only. SUPER_ADMIN may manage STAFF/ADMIN, but
-- neither role can alter a SUPER_ADMIN profile through this RPC.
create or replace function public.admin_set_staff(
  p_actor uuid,
  p_target uuid,
  p_role text,
  p_state text,
  p_name text,
  p_email text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_actor_role public.admin_role;
  v_target_role public.admin_role;
begin
  select role into v_actor_role
  from public.profiles
  where id = p_actor and account_state = 'ACTIVE';

  if v_actor_role not in ('SUPER_ADMIN', 'ADMIN') or v_actor_role is null then
    raise exception 'Forbidden';
  end if;
  if p_role not in ('ADMIN', 'STAFF') or p_state not in ('ACTIVE', 'DISABLED') then
    raise exception 'Invalid staff settings';
  end if;
  if p_name is null or length(trim(p_name)) < 2 or length(p_name) > 100
     or p_email is null or length(p_email) > 254
     or p_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Invalid staff details';
  end if;

  select role into v_target_role from public.profiles where id = p_target for update;
  if not found or v_target_role = 'SUPER_ADMIN' then
    raise exception 'Staff profile not found or protected';
  end if;
  if v_actor_role = 'ADMIN' and (v_target_role <> 'STAFF' or p_role <> 'STAFF') then
    raise exception 'Only a super administrator may manage administrator accounts';
  end if;

  update public.profiles
  set role = p_role::public.admin_role,
      account_state = p_state::public.account_state,
      full_name = trim(p_name),
      notification_email = lower(trim(p_email))
  where id = p_target;

  insert into public.admin_activity(actor_id, action, entity_type, entity_id, details)
  values (p_actor, 'STAFF_SETTINGS_CHANGED', 'STAFF', p_target,
    jsonb_build_object('role', p_role, 'state', p_state));
end;
$$;

-- Put system catalogs first and temporary schemas last for every existing
-- SECURITY DEFINER function, preventing object shadowing through search_path.
alter function public.current_admin_role() set search_path = pg_catalog, public, auth, pg_temp;
alter function public.is_active_account() set search_path = pg_catalog, public, auth, pg_temp;
alter function public.create_disabled_profile() set search_path = pg_catalog, public, auth, pg_temp;
alter function public.on_enquiry_created() set search_path = pg_catalog, public, auth, pg_temp;
alter function public.submit_public_enquiry(jsonb, uuid, text) set search_path = pg_catalog, public, auth, pg_temp;
alter function public.admin_update_enquiry_status(uuid, text) set search_path = pg_catalog, public, auth, pg_temp;
alter function public.admin_assign_enquiry(uuid, uuid) set search_path = pg_catalog, public, auth, pg_temp;
alter function public.admin_add_enquiry_note(uuid, text) set search_path = pg_catalog, public, auth, pg_temp;
alter function public.admin_delete_enquiry(uuid) set search_path = pg_catalog, public, auth, pg_temp;
alter function public.admin_dashboard_stats() set search_path = pg_catalog, public, auth, pg_temp;
alter function public.admin_mark_notification_read(uuid) set search_path = pg_catalog, public, auth, pg_temp;
alter function public.record_own_login() set search_path = pg_catalog, public, auth, pg_temp;
alter function public.admin_update_product(text, jsonb, boolean) set search_path = pg_catalog, public, auth, pg_temp;
alter function public.admin_create_product(jsonb) set search_path = pg_catalog, public, auth, pg_temp;
alter function public.admin_update_service(text, jsonb, boolean) set search_path = pg_catalog, public, auth, pg_temp;
alter function public.admin_update_site_settings(jsonb) set search_path = pg_catalog, public, auth, pg_temp;
alter function public.public_contact_settings() set search_path = pg_catalog, public, auth, pg_temp;
alter function public.admin_set_email_delivery(uuid, text, text, text) set search_path = pg_catalog, public, auth, pg_temp;
alter function public.admin_set_staff(uuid, uuid, text, text, text, text) set search_path = pg_catalog, public, auth, pg_temp;
alter function public.admin_set_enquiry_follow_up(uuid, timestamptz) set search_path = pg_catalog, public, auth, pg_temp;

revoke all on function public.touch_enquiry_updated_at() from public, anon, authenticated;
revoke all on function public.admin_set_staff(uuid, uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.admin_set_staff(uuid, uuid, text, text, text, text) to service_role;
