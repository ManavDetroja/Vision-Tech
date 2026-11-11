-- VisionTech secure admin/enquiry schema. Apply only to a dedicated Supabase project.
create extension if not exists pgcrypto;

do $$ begin create type public.admin_role as enum ('SUPER_ADMIN', 'ADMIN', 'STAFF'); exception when duplicate_object then null; end $$;
do $$ begin create type public.account_state as enum ('ACTIVE', 'DISABLED'); exception when duplicate_object then null; end $$;
do $$ begin create type public.enquiry_status as enum ('NEW', 'CONTACTED', 'IN_PROGRESS', 'RESOLVED'); exception when duplicate_object then null; end $$;
do $$ begin create type public.enquiry_type as enum ('PRODUCT_INFORMATION', 'CCTV_INSTALLATION', 'CCTV_REPAIR', 'CCTV_MAINTENANCE', 'CCTV_UPGRADE', 'GENERAL_ENQUIRY'); exception when duplicate_object then null; end $$;

create sequence if not exists public.enquiry_number_seq;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  notification_email text not null default '',
  role public.admin_role not null default 'STAFF',
  account_state public.account_state not null default 'DISABLED',
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table if not exists public.enquiries (
  id uuid primary key default gen_random_uuid(),
  enquiry_code text not null unique,
  idempotency_key uuid not null unique,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  enquiry_type public.enquiry_type not null,
  product_model text,
  service_requirement text,
  customer_message text not null,
  consented_at timestamptz not null,
  created_at timestamptz not null default now(),
  status public.enquiry_status not null default 'NEW',
  assigned_to uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz
);

create table if not exists public.enquiry_notes (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references public.enquiries(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete restrict,
  note text not null check (char_length(note) between 1 and 4000),
  created_at timestamptz not null default now()
);

create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  enquiry_id uuid references public.enquiries(id) on delete set null,
  kind text not null,
  title text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null unique references public.enquiries(id) on delete cascade,
  recipient_ids uuid[] not null default '{}',
  status text not null default 'PENDING' check (status in ('PENDING', 'SENT', 'FAILED')),
  attempts integer not null default 0,
  provider_message_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz
);

create table if not exists public.admin_activity (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.submission_rate_limits (
  bucket_key text not null,
  window_start timestamptz not null,
  hit_count integer not null default 0,
  primary key (bucket_key, window_start)
);

create table if not exists public.products (
  id text primary key,
  model text not null unique,
  category_id text not null,
  record jsonb not null,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  check (record->>'id' = id),
  check (record->>'model' = model),
  check (record->>'categoryId' = category_id)
);

create table if not exists public.service_content (
  id text primary key,
  record jsonb not null,
  is_visible boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  check (record->>'id' = id)
);

create table if not exists public.site_settings (
  id text primary key check (id = 'public'),
  settings jsonb not null default '{"showEmail":false,"showPhone":false,"showAddress":false,"showBusinessHours":false,"showMap":false}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
insert into public.site_settings (id, settings) values ('public', '{"showEmail":false,"showPhone":false,"showAddress":false,"showBusinessHours":false,"showMap":false}'::jsonb)
on conflict (id) do nothing;

create index if not exists enquiries_created_at_idx on public.enquiries (created_at desc);
create index if not exists enquiries_status_idx on public.enquiries (status, created_at desc);
create index if not exists enquiries_assigned_to_idx on public.enquiries (assigned_to, created_at desc);
create index if not exists enquiry_notes_enquiry_idx on public.enquiry_notes (enquiry_id, created_at desc);
create index if not exists notifications_unread_idx on public.admin_notifications (recipient_id, created_at desc) where read_at is null;
create index if not exists admin_activity_created_idx on public.admin_activity (created_at desc);
create index if not exists submission_rate_limits_window_idx on public.submission_rate_limits (window_start);

create or replace function public.current_admin_role()
returns text language sql stable security definer set search_path = public, auth
as $$ select role::text from public.profiles where id = auth.uid() and account_state = 'ACTIVE' $$;

create or replace function public.is_active_account()
returns boolean language sql stable security definer set search_path = public, auth
as $$ select exists (select 1 from public.profiles where id = auth.uid() and account_state = 'ACTIVE') $$;

revoke all on function public.current_admin_role() from public;
revoke all on function public.is_active_account() from public;
grant execute on function public.current_admin_role(), public.is_active_account() to authenticated;
grant execute on function public.current_admin_role() to anon;

create or replace function public.create_disabled_profile()
returns trigger language plpgsql security definer set search_path = public, auth
as $$
begin
  insert into public.profiles(id, full_name, notification_email, role, account_state)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), coalesce(new.email, ''), 'STAFF', 'DISABLED')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists auth_user_profile_created on auth.users;
create trigger auth_user_profile_created after insert on auth.users for each row execute function public.create_disabled_profile();

create or replace function public.on_enquiry_created()
returns trigger language plpgsql security definer set search_path = public
as $$
declare admin_ids uuid[];
begin
  insert into public.admin_notifications(recipient_id, enquiry_id, kind, title)
  select id, new.id, 'NEW_ENQUIRY', 'A new customer enquiry was received'
  from public.profiles where account_state = 'ACTIVE' and role in ('SUPER_ADMIN', 'ADMIN');

  select coalesce(array_agg(id), '{}') into admin_ids
  from public.profiles
  where account_state = 'ACTIVE' and role in ('SUPER_ADMIN', 'ADMIN') and notification_email <> '';

  insert into public.email_outbox(enquiry_id, recipient_ids, status, last_error)
  values (new.id, admin_ids,
    case when cardinality(admin_ids) = 0 then 'FAILED' else 'PENDING' end,
    case when cardinality(admin_ids) = 0 then 'No active administrator notification email is configured.' else null end);

  insert into public.admin_activity(actor_id, action, entity_type, entity_id, details)
  values (null, 'ENQUIRY_CREATED', 'ENQUIRY', new.id, jsonb_build_object('status', 'NEW'));
  return new;
end;
$$;

drop trigger if exists enquiry_created_events on public.enquiries;
create trigger enquiry_created_events after insert on public.enquiries for each row execute function public.on_enquiry_created();

-- Called only by the private Node API using its server-side service-role credential.
-- Enquiry insert, inbox notifications, email outbox and audit record are one DB transaction.
create or replace function public.submit_public_enquiry(p_payload jsonb, p_idempotency_key uuid, p_rate_hash text)
returns jsonb language plpgsql security definer set search_path = public, auth
as $$
declare
  v_window timestamptz := date_trunc('hour', now()) + floor(extract(minute from now()) / 15) * interval '15 minutes';
  v_hits integer;
  v_type public.enquiry_type;
  v_row public.enquiries;
  v_duplicate boolean := false;
  v_outbox_id uuid;
  v_phone text := coalesce(p_payload->>'phone', '');
begin
  if auth.role() <> 'service_role' then raise exception 'Forbidden'; end if;
  if p_idempotency_key is null or coalesce(p_rate_hash, '') !~ '^[a-f0-9]{64}$' then raise exception 'Invalid request metadata'; end if;
  if coalesce(p_payload->>'website', '') <> '' then raise exception 'Submission rejected'; end if;
  if coalesce(p_payload->>'consent', 'false') <> 'true' then raise exception 'Consent is required'; end if;
  if char_length(btrim(coalesce(p_payload->>'name', ''))) not between 2 and 100 then raise exception 'Invalid name'; end if;
  if char_length(btrim(coalesce(p_payload->>'email', ''))) > 254 or btrim(coalesce(p_payload->>'email', '')) !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid email'; end if;
  if char_length(v_phone) > 20 or v_phone !~ '^\+?[0-9() .-]+$' or length(regexp_replace(v_phone, '\D', '', 'g')) not between 7 and 15 then raise exception 'Invalid phone'; end if;
  if char_length(btrim(coalesce(p_payload->>'message', ''))) not between 20 and 2000 then raise exception 'Invalid message'; end if;
  if char_length(coalesce(p_payload->>'productModel', '')) > 100 or char_length(coalesce(p_payload->>'serviceRequirement', '')) > 180 then raise exception 'Invalid optional field'; end if;

  v_type := case p_payload->>'enquiryType'
    when 'product' then 'PRODUCT_INFORMATION'::public.enquiry_type
    when 'installation' then 'CCTV_INSTALLATION'::public.enquiry_type
    when 'repair' then 'CCTV_REPAIR'::public.enquiry_type
    when 'maintenance' then 'CCTV_MAINTENANCE'::public.enquiry_type
    when 'upgrade' then 'CCTV_UPGRADE'::public.enquiry_type
    when 'general' then 'GENERAL_ENQUIRY'::public.enquiry_type
    else null end;
  if v_type is null then raise exception 'Invalid enquiry type'; end if;
  if v_type in ('CCTV_INSTALLATION', 'CCTV_REPAIR', 'CCTV_MAINTENANCE', 'CCTV_UPGRADE')
     and char_length(btrim(coalesce(p_payload->>'serviceRequirement', ''))) = 0 then
    raise exception 'Service requirement is required';
  end if;

  delete from public.submission_rate_limits where window_start < now() - interval '2 days';

  select * into v_row from public.enquiries where idempotency_key = p_idempotency_key;
  if found then
    v_duplicate := true;
  else
    insert into public.submission_rate_limits(bucket_key, window_start, hit_count)
    values (p_rate_hash, v_window, 1)
    on conflict (bucket_key, window_start) do update set hit_count = public.submission_rate_limits.hit_count + 1
    returning hit_count into v_hits;
    if v_hits > 5 then raise exception 'Too many submissions. Please try again later.'; end if;

    insert into public.enquiries(
      enquiry_code, idempotency_key, customer_name, customer_email, customer_phone, enquiry_type,
      product_model, service_requirement, customer_message, consented_at, status
    ) values (
      'VT-' || to_char(now() at time zone 'UTC', 'YYYYMMDD') || '-' || lpad(nextval('public.enquiry_number_seq')::text, 6, '0'),
      p_idempotency_key, btrim(p_payload->>'name'), lower(btrim(p_payload->>'email')), btrim(v_phone), v_type,
      nullif(btrim(coalesce(p_payload->>'productModel', '')), ''),
      nullif(btrim(coalesce(p_payload->>'serviceRequirement', '')), ''),
      btrim(p_payload->>'message'), now(), 'NEW'
    ) on conflict (idempotency_key) do nothing returning * into v_row;
    if not found then
      select * into v_row from public.enquiries where idempotency_key = p_idempotency_key;
      v_duplicate := true;
    end if;
  end if;

  select id into v_outbox_id from public.email_outbox where enquiry_id = v_row.id;
  return jsonb_build_object('accepted', true, 'duplicate', v_duplicate, 'id', v_row.id,
    'enquiryCode', v_row.enquiry_code, 'createdAt', v_row.created_at, 'emailOutboxId', v_outbox_id);
end;
$$;

create or replace function public.admin_update_enquiry_status(p_enquiry_id uuid, p_status text)
returns public.enquiries language plpgsql security definer set search_path = public, auth
as $$
declare v_role text := public.current_admin_role(); v_row public.enquiries;
begin
  if v_role is null or p_status not in ('NEW', 'CONTACTED', 'IN_PROGRESS', 'RESOLVED') then raise exception 'Forbidden or invalid status'; end if;
  if v_role = 'STAFF' and not exists (select 1 from public.enquiries where id = p_enquiry_id and assigned_to = auth.uid()) then raise exception 'Forbidden'; end if;
  update public.enquiries set status = p_status::public.enquiry_status,
    resolved_at = case when p_status = 'RESOLVED' then coalesce(resolved_at, now()) else null end
  where id = p_enquiry_id returning * into v_row;
  if not found then raise exception 'Enquiry not found'; end if;
  insert into public.admin_activity(actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'ENQUIRY_STATUS_CHANGED', 'ENQUIRY', p_enquiry_id, jsonb_build_object('status', p_status));
  return v_row;
end;
$$;

create or replace function public.admin_assign_enquiry(p_enquiry_id uuid, p_assignee uuid)
returns public.enquiries language plpgsql security definer set search_path = public, auth
as $$
declare v_row public.enquiries;
begin
  if coalesce(public.current_admin_role(), '') not in ('SUPER_ADMIN', 'ADMIN') then raise exception 'Forbidden'; end if;
  if p_assignee is not null and not exists (select 1 from public.profiles where id = p_assignee and account_state = 'ACTIVE') then raise exception 'Assignee is not active'; end if;
  update public.enquiries set assigned_to = p_assignee where id = p_enquiry_id returning * into v_row;
  if not found then raise exception 'Enquiry not found'; end if;
  insert into public.admin_activity(actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'ENQUIRY_ASSIGNED', 'ENQUIRY', p_enquiry_id, jsonb_build_object('assignedTo', p_assignee));
  if p_assignee is not null then
    insert into public.admin_notifications(recipient_id, enquiry_id, kind, title)
    values (p_assignee, p_enquiry_id, 'ENQUIRY_ASSIGNED', 'A customer enquiry was assigned to you');
  end if;
  return v_row;
end;
$$;

create or replace function public.admin_add_enquiry_note(p_enquiry_id uuid, p_note text)
returns public.enquiry_notes language plpgsql security definer set search_path = public, auth
as $$
declare v_note public.enquiry_notes;
begin
  if public.current_admin_role() is null or char_length(btrim(coalesce(p_note, ''))) not between 1 and 4000 then raise exception 'Forbidden or invalid note'; end if;
  if public.current_admin_role() = 'STAFF' and not exists (select 1 from public.enquiries where id = p_enquiry_id and assigned_to = auth.uid()) then raise exception 'Forbidden'; end if;
  insert into public.enquiry_notes(enquiry_id, author_id, note) values (p_enquiry_id, auth.uid(), btrim(p_note)) returning * into v_note;
  insert into public.admin_activity(actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'ENQUIRY_NOTE_ADDED', 'ENQUIRY', p_enquiry_id, jsonb_build_object('noteId', v_note.id));
  return v_note;
end;
$$;

create or replace function public.admin_delete_enquiry(p_enquiry_id uuid)
returns void language plpgsql security definer set search_path = public, auth
as $$
begin
  if coalesce(public.current_admin_role(), '') <> 'SUPER_ADMIN' then raise exception 'Forbidden'; end if;
  insert into public.admin_activity(actor_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'ENQUIRY_DELETED', 'ENQUIRY', p_enquiry_id, '{}'::jsonb);
  delete from public.enquiries where id = p_enquiry_id;
  if not found then raise exception 'Enquiry not found'; end if;
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
    'resolved', (select count(*) from public.enquiries where status = 'RESOLVED' and (v_role in ('SUPER_ADMIN', 'ADMIN') or assigned_to = auth.uid())),
    'products', case when v_role in ('SUPER_ADMIN', 'ADMIN') then (select count(*) from public.products) else null end,
    'activeStaff', case when v_role in ('SUPER_ADMIN', 'ADMIN') then (select count(*) from public.profiles where account_state = 'ACTIVE') else null end
  );
end;
$$;

create or replace function public.admin_mark_notification_read(p_notification_id uuid)
returns void language plpgsql security definer set search_path = public, auth
as $$
begin
  if not public.is_active_account() then raise exception 'Forbidden'; end if;
  update public.admin_notifications set read_at = coalesce(read_at, now())
  where id = p_notification_id and recipient_id = auth.uid();
  if not found then raise exception 'Notification not found'; end if;
end;
$$;

create or replace function public.record_own_login()
returns void language plpgsql security definer set search_path = public, auth
as $$
begin
  update public.profiles set last_login_at = now() where id = auth.uid() and account_state = 'ACTIVE';
  if not found then raise exception 'Account is disabled'; end if;
end;
$$;

create or replace function public.admin_update_product(p_id text, p_patch jsonb, p_is_visible boolean)
returns public.products language plpgsql security definer set search_path = public, auth
as $$
declare v_row public.products;
begin
  if coalesce(public.current_admin_role(), '') not in ('SUPER_ADMIN', 'ADMIN') then raise exception 'Forbidden'; end if;
  if p_patch ? 'id' or p_patch ? 'model' or p_patch ? 'categoryId' or p_patch ? 'modelNumber' then raise exception 'Product identity fields cannot be changed'; end if;
  update public.products set record = record || p_patch, is_visible = p_is_visible, updated_at = now(), updated_by = auth.uid()
  where id = p_id returning * into v_row;
  if not found then raise exception 'Product not found'; end if;
  insert into public.admin_activity(actor_id, action, entity_type, details)
  values (auth.uid(), 'PRODUCT_UPDATED', 'PRODUCT', jsonb_build_object('productId', p_id));
  return v_row;
end;
$$;

create or replace function public.admin_create_product(p_record jsonb)
returns public.products language plpgsql security definer set search_path = public, auth
as $$
declare v_row public.products;
begin
  if coalesce(public.current_admin_role(), '') not in ('SUPER_ADMIN', 'ADMIN') then raise exception 'Forbidden'; end if;
  if char_length(coalesce(p_record->>'model', '')) not between 1 and 100 or coalesce(p_record->>'id', '') = '' or coalesce(p_record->>'categoryId', '') = '' then raise exception 'Product id, exact model and category are required'; end if;
  insert into public.products(id, model, category_id, record, is_visible, updated_by)
  values (p_record->>'id', p_record->>'model', p_record->>'categoryId', p_record, true, auth.uid()) returning * into v_row;
  insert into public.admin_activity(actor_id, action, entity_type, details)
  values (auth.uid(), 'PRODUCT_CREATED', 'PRODUCT', jsonb_build_object('productId', v_row.id));
  return v_row;
end;
$$;

create or replace function public.admin_update_service(p_id text, p_record jsonb, p_is_visible boolean)
returns public.service_content language plpgsql security definer set search_path = public, auth
as $$
declare v_row public.service_content;
begin
  if coalesce(public.current_admin_role(), '') not in ('SUPER_ADMIN', 'ADMIN') then raise exception 'Forbidden'; end if;
  if p_record->>'id' is distinct from p_id then raise exception 'Service id cannot be changed'; end if;
  insert into public.service_content(id, record, is_visible, updated_by)
  values (p_id, p_record, p_is_visible, auth.uid())
  on conflict (id) do update set record = excluded.record, is_visible = excluded.is_visible, updated_at = now(), updated_by = auth.uid()
  returning * into v_row;
  insert into public.admin_activity(actor_id, action, entity_type, details)
  values (auth.uid(), 'SERVICE_UPDATED', 'SERVICE', jsonb_build_object('serviceId', p_id));
  return v_row;
end;
$$;

create or replace function public.admin_update_site_settings(p_settings jsonb)
returns void language plpgsql security definer set search_path = public, auth
as $$
begin
  if coalesce(public.current_admin_role(), '') <> 'SUPER_ADMIN' then raise exception 'Forbidden'; end if;
  if jsonb_typeof(p_settings->'showEmail') is distinct from 'boolean' or jsonb_typeof(p_settings->'showPhone') is distinct from 'boolean'
     or jsonb_typeof(p_settings->'showAddress') is distinct from 'boolean' or jsonb_typeof(p_settings->'showBusinessHours') is distinct from 'boolean'
     or jsonb_typeof(p_settings->'showMap') is distinct from 'boolean' then raise exception 'Contact publication switches must be boolean'; end if;
  if char_length(coalesce(p_settings->>'email', '')) > 254 or char_length(coalesce(p_settings->>'phone', '')) > 40
     or char_length(coalesce(p_settings->>'address', '')) > 500 or char_length(coalesce(p_settings->>'businessHours', '')) > 300
     or char_length(coalesce(p_settings->>'mapUrl', '')) > 1000 then raise exception 'A public contact value is too long'; end if;
  if (p_settings->>'showEmail')::boolean and coalesce(p_settings->>'email', '') !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'A valid approved email is required before publication'; end if;
  if (p_settings->>'showPhone')::boolean and char_length(coalesce(p_settings->>'phone', '')) < 7 then raise exception 'An approved business phone number is required before publication'; end if;
  if (p_settings->>'showAddress')::boolean and btrim(coalesce(p_settings->>'address', '')) = '' then raise exception 'An approved business address is required before publication'; end if;
  if (p_settings->>'showBusinessHours')::boolean and btrim(coalesce(p_settings->>'businessHours', '')) = '' then raise exception 'Approved business hours are required before publication'; end if;
  if (p_settings->>'showMap')::boolean and coalesce(p_settings->>'mapUrl', '') !~ '^https://www\.google\.[^/]+/maps([/?].*)?$' then raise exception 'An approved Google Maps URL is required before publication'; end if;
  insert into public.site_settings(id, settings, updated_by) values ('public', p_settings, auth.uid())
  on conflict (id) do update set settings = excluded.settings, updated_at = now(), updated_by = auth.uid();
  insert into public.admin_activity(actor_id, action, entity_type, details)
  values (auth.uid(), 'SITE_SETTINGS_UPDATED', 'SITE_SETTINGS', '{}'::jsonb);
end;
$$;

create or replace function public.public_contact_settings()
returns jsonb language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_strip_nulls(jsonb_build_object(
    'email', case when (settings->>'showEmail')::boolean then settings->'email' else null end,
    'phone', case when (settings->>'showPhone')::boolean then settings->'phone' else null end,
    'address', case when (settings->>'showAddress')::boolean then settings->'address' else null end,
    'businessHours', case when (settings->>'showBusinessHours')::boolean then settings->'businessHours' else null end,
    'mapUrl', case when (settings->>'showMap')::boolean then settings->'mapUrl' else null end
  )), '{}'::jsonb)
  from public.site_settings where id = 'public'
$$;

create or replace function public.admin_set_email_delivery(p_outbox_id uuid, p_status text, p_provider_id text, p_error text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if auth.role() <> 'service_role' or p_status not in ('PENDING', 'SENT', 'FAILED') then raise exception 'Forbidden or invalid status'; end if;
  update public.email_outbox set status = p_status, attempts = attempts + 1,
    provider_message_id = p_provider_id, last_error = left(p_error, 1000), updated_at = now(),
    sent_at = case when p_status = 'SENT' then now() else null end
  where id = p_outbox_id;
  if not found then raise exception 'Notification record not found'; end if;
end;
$$;

create or replace function public.admin_set_staff(p_actor uuid, p_target uuid, p_role text, p_state text, p_name text, p_email text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = p_actor and role = 'SUPER_ADMIN' and account_state = 'ACTIVE') then raise exception 'Forbidden'; end if;
  if p_role not in ('ADMIN', 'STAFF') or p_state not in ('ACTIVE', 'DISABLED') then raise exception 'Invalid staff settings'; end if;
  update public.profiles set role = p_role::public.admin_role, account_state = p_state::public.account_state,
    full_name = left(coalesce(p_name, ''), 100), notification_email = lower(left(coalesce(p_email, ''), 254))
  where id = p_target;
  if not found then raise exception 'Staff profile not found'; end if;
  insert into public.admin_activity(actor_id, action, entity_type, entity_id, details)
  values (p_actor, 'STAFF_SETTINGS_CHANGED', 'STAFF', p_target, jsonb_build_object('role', p_role, 'state', p_state));
end;
$$;

alter table public.profiles enable row level security;
alter table public.enquiries enable row level security;
alter table public.enquiry_notes enable row level security;
alter table public.admin_notifications enable row level security;
alter table public.email_outbox enable row level security;
alter table public.admin_activity enable row level security;
alter table public.submission_rate_limits enable row level security;
alter table public.products enable row level security;
alter table public.service_content enable row level security;
alter table public.site_settings enable row level security;

drop policy if exists profiles_read_self_or_admin on public.profiles;
create policy profiles_read_self_or_admin on public.profiles for select to authenticated
using (id = auth.uid() or public.current_admin_role() in ('SUPER_ADMIN', 'ADMIN'));
drop policy if exists enquiries_read_authorized on public.enquiries;
create policy enquiries_read_authorized on public.enquiries for select to authenticated
using (public.current_admin_role() in ('SUPER_ADMIN', 'ADMIN') or (public.current_admin_role() = 'STAFF' and assigned_to = auth.uid()));
drop policy if exists notes_read_authorized on public.enquiry_notes;
create policy notes_read_authorized on public.enquiry_notes for select to authenticated
using (public.current_admin_role() in ('SUPER_ADMIN', 'ADMIN') or exists (select 1 from public.enquiries e where e.id = enquiry_id and e.assigned_to = auth.uid()));
drop policy if exists notifications_read_self on public.admin_notifications;
create policy notifications_read_self on public.admin_notifications for select to authenticated
using (recipient_id = auth.uid() and public.is_active_account());
drop policy if exists notifications_update_self on public.admin_notifications;
create policy notifications_update_self on public.admin_notifications for update to authenticated
using (recipient_id = auth.uid() and public.is_active_account())
with check (recipient_id = auth.uid() and public.is_active_account());
drop policy if exists email_outbox_admin_read on public.email_outbox;
create policy email_outbox_admin_read on public.email_outbox for select to authenticated
using (public.current_admin_role() in ('SUPER_ADMIN', 'ADMIN'));
drop policy if exists activity_read_admin_or_actor on public.admin_activity;
create policy activity_read_admin_or_actor on public.admin_activity for select to authenticated
using (public.current_admin_role() in ('SUPER_ADMIN', 'ADMIN') or actor_id = auth.uid());
drop policy if exists products_read_published on public.products;
create policy products_read_published on public.products for select to anon, authenticated
using (is_visible or public.current_admin_role() in ('SUPER_ADMIN', 'ADMIN'));
drop policy if exists services_read_published on public.service_content;
create policy services_read_published on public.service_content for select to anon, authenticated
using (is_visible or public.current_admin_role() in ('SUPER_ADMIN', 'ADMIN'));
drop policy if exists site_settings_admin_read on public.site_settings;
create policy site_settings_admin_read on public.site_settings for select to authenticated
using (public.current_admin_role() = 'SUPER_ADMIN');

revoke all on public.profiles, public.enquiries, public.enquiry_notes, public.admin_notifications,
  public.email_outbox, public.admin_activity, public.submission_rate_limits, public.products, public.service_content, public.site_settings from anon, authenticated;
grant select on public.products, public.service_content to anon;
grant select on public.profiles, public.enquiries, public.enquiry_notes, public.admin_notifications,
  public.email_outbox, public.admin_activity, public.products, public.service_content to authenticated;
grant select on public.site_settings to authenticated;
grant update (read_at) on public.admin_notifications to authenticated;
grant usage, select on sequence public.enquiry_number_seq to service_role;

revoke all on function public.submit_public_enquiry(jsonb, uuid, text) from public, anon, authenticated;
grant execute on function public.submit_public_enquiry(jsonb, uuid, text) to service_role;
revoke all on function public.admin_update_enquiry_status(uuid, text) from public, anon;
grant execute on function public.admin_update_enquiry_status(uuid, text) to authenticated;
revoke all on function public.admin_assign_enquiry(uuid, uuid) from public, anon;
grant execute on function public.admin_assign_enquiry(uuid, uuid) to authenticated;
revoke all on function public.admin_add_enquiry_note(uuid, text) from public, anon;
grant execute on function public.admin_add_enquiry_note(uuid, text) to authenticated;
revoke all on function public.admin_delete_enquiry(uuid) from public, anon;
grant execute on function public.admin_delete_enquiry(uuid) to authenticated;
revoke all on function public.admin_dashboard_stats() from public, anon;
grant execute on function public.admin_dashboard_stats() to authenticated;
revoke all on function public.admin_mark_notification_read(uuid) from public, anon;
grant execute on function public.admin_mark_notification_read(uuid) to authenticated;
revoke all on function public.record_own_login() from public, anon;
grant execute on function public.record_own_login() to authenticated;
revoke all on function public.admin_update_product(text, jsonb, boolean) from public, anon;
grant execute on function public.admin_update_product(text, jsonb, boolean) to authenticated;
revoke all on function public.admin_create_product(jsonb) from public, anon;
grant execute on function public.admin_create_product(jsonb) to authenticated;
revoke all on function public.admin_update_service(text, jsonb, boolean) from public, anon;
grant execute on function public.admin_update_service(text, jsonb, boolean) to authenticated;
revoke all on function public.admin_update_site_settings(jsonb) from public, anon;
grant execute on function public.admin_update_site_settings(jsonb) to authenticated;
revoke all on function public.public_contact_settings() from public;
grant execute on function public.public_contact_settings() to anon, authenticated;
revoke all on function public.admin_set_email_delivery(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.admin_set_email_delivery(uuid, text, text, text) to service_role;
revoke all on function public.admin_set_staff(uuid, uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.admin_set_staff(uuid, uuid, text, text, text, text) to service_role;

-- Run once in the private Supabase SQL editor after creating a bootstrap Auth user.
-- update public.profiles set role = 'SUPER_ADMIN', account_state = 'ACTIVE' where id = '<AUTH_USER_UUID>';

