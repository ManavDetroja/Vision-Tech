-- Immutable private originals and derivatives. Only the API has bucket write credentials.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('visiontech-product-media','visiontech-product-media',false,8388608,
        array['image/jpeg','image/png','image/webp']);

create policy product_media_no_client_objects on storage.objects as restrictive
for all to anon, authenticated
using (bucket_id <> 'visiontech-product-media')
with check (bucket_id <> 'visiontech-product-media');

create table public.product_media (
  id uuid primary key default gen_random_uuid(),
  model text not null check (model ~ '^[A-Z0-9][A-Z0-9-]{0,99}$' and model not in ('CP-Z42Q','CP-UNC-DA41L3C-Q2','CP-DNW-HPU8G2-6-V3')),
  original_sha text not null check (original_sha ~ '^[0-9a-f]{64}$'),
  jpeg_sha text not null check (jpeg_sha ~ '^[0-9a-f]{64}$'),
  original_type text not null check (original_type in ('image/jpeg','image/png','image/webp')),
  original_bytes integer not null check(original_bytes between 1 and 4194304),
  jpeg_bytes integer not null check(jpeg_bytes between 1 and 8388608),
  width integer not null check(width between 1 and 1800),
  height integer not null check(height between 1 and 1800),
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  approved boolean not null default false,
  evidence text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  unique(model,original_sha),
  check (not approved or (reviewed_by is not null and reviewed_by <> uploaded_by and reviewed_at is not null and length(trim(evidence)) > 0 and evidence is not null))
);
alter table public.product_media enable row level security;
revoke all on public.product_media from public, anon, authenticated, service_role;
grant select on public.product_media to authenticated, service_role;
grant insert (model,original_sha,jpeg_sha,original_type,original_bytes,jpeg_bytes,width,height,uploaded_by) on public.product_media to service_role;
create policy product_media_manager_read on public.product_media for select to authenticated
using (public.current_admin_role() in ('ADMIN','SUPER_ADMIN'));

create function public.guard_media_registration() returns trigger language plpgsql
security definer set search_path=pg_catalog,public,auth,pg_temp as $guard$
begin
  perform 1 from public.profiles where id=new.uploaded_by and role in ('ADMIN','SUPER_ADMIN') and account_state='ACTIVE' for share;
  if not found then raise exception 'Forbidden'; end if;
  return new;
end $guard$;
revoke all on function public.guard_media_registration() from public,anon,authenticated,service_role;
create trigger product_media_uploader before insert on public.product_media
for each row execute function public.guard_media_registration();

create function public.review_product_media(p_id uuid,p_approved boolean,p_evidence text)
returns void language plpgsql security definer set search_path=pg_catalog,public,auth,pg_temp as $$
begin
  if public.current_admin_role() is distinct from 'SUPER_ADMIN' then raise exception 'Forbidden'; end if;
  if p_approved is null or coalesce(length(trim(p_evidence)),0) not between 1 and 1000 then raise exception 'Review evidence required'; end if;
  update public.product_media set approved=p_approved, evidence=trim(p_evidence),reviewed_by=auth.uid(),reviewed_at=now()
  where id=p_id and (not p_approved or uploaded_by<>auth.uid());
  if not found then raise exception 'Independent reviewer required or asset unavailable'; end if;
  insert into public.admin_activity(actor_id,action,entity_type,entity_id,details)
  values(auth.uid(),case when p_approved then 'PRODUCT_MEDIA_APPROVED' else 'PRODUCT_MEDIA_WITHDRAWN' end,'PRODUCT_MEDIA',p_id,jsonb_build_object('evidence',trim(p_evidence)));
end $$;
revoke all on function public.review_product_media(uuid,boolean,text) from public,anon,service_role;
grant execute on function public.review_product_media(uuid,boolean,text) to authenticated;

-- Shared enforcement includes legacy RPCs and the versioned editor. Trusted bootstrap
-- and database maintenance have no end-user subject and no client table grants.
create function public.guard_product_record() returns trigger language plpgsql
set search_path=pg_catalog,public,auth,pg_temp as $$
declare
  previous jsonb := case when tg_op='UPDATE' then old.record else '{}'::jsonb end;
  editable text[] := array['id','model','categoryId','subcategory','name','brand','summary','description','seoTitle','seoDescription','featured','resolutionMp','features','specifications','pendingSource','mediaIds'];
  media_id text;
begin
  if auth.uid() is null then return new; end if;
  if coalesce(public.current_admin_role(),'') not in ('ADMIN','SUPER_ADMIN') then raise exception 'Forbidden'; end if;
  if jsonb_typeof(new.record) <> 'object' or (new.record - editable) <> (previous - editable) then raise exception 'Protected product fields'; end if;
  if tg_op='UPDATE' and (new.id<>old.id or new.model<>old.model) then raise exception 'Immutable product identity'; end if;
  if exists (select 1 from jsonb_each(new.record) e where
    (e.key in ('id','model','categoryId','name','brand','summary','description','seoTitle','seoDescription','pendingSource') and jsonb_typeof(e.value) not in ('string','null')) or
    (e.key='featured' and jsonb_typeof(e.value)<>'boolean') or
    (e.key='specifications' and jsonb_typeof(e.value)<>'object') or
    (e.key='resolutionMp' and jsonb_typeof(e.value) not in ('number','null')) or
    (e.key='features' and jsonb_typeof(e.value)<>'array')) then raise exception 'Invalid product fields'; end if;
  if new.record ? 'features' and exists(select 1 from jsonb_array_elements(new.record->'features') f where jsonb_typeof(f)<>'string') then raise exception 'Invalid product features'; end if;
  if new.record ? 'mediaIds' then
    if jsonb_typeof(new.record->'mediaIds') <> 'array' or jsonb_array_length(new.record->'mediaIds')>30 then raise exception 'Invalid media selection'; end if;
    for media_id in select jsonb_array_elements_text(new.record->'mediaIds') loop
      if not exists (select 1 from public.product_media m where m.id::text=media_id and m.model=new.model) then raise exception 'Invalid media selection'; end if;
    end loop;
  end if;
  -- Never carry source verification across a change to the underlying facts.
  if tg_op='UPDATE' and (previous->'specifications' is distinct from new.record->'specifications'
      or previous->'resolutionMp' is distinct from new.record->'resolutionMp'
      or previous->'features' is distinct from new.record->'features') then
    new.record := new.record - array['verification','specificationEvidence','featureSource','verifiedOn','verificationStatus'];
  end if;
  if tg_op='UPDATE' and previous->'name' is distinct from new.record->'name' then new.record := new.record-'officialName'; end if;
  return new;
end $$;
revoke all on function public.guard_product_record() from public,anon,authenticated;
create trigger product_record_field_guard before insert or update on public.products
for each row execute function public.guard_product_record();

-- Public projection supplies only reviewed and attached ids for currently visible products.
create view public.published_product_media with (security_barrier=true) as
select m.id,m.model
from public.product_media m join public.products p on p.model=m.model
where m.approved and p.is_visible and (p.record->'mediaIds') ? m.id::text;
revoke all on public.published_product_media from public,anon,authenticated,service_role;
grant select on public.published_product_media to anon,authenticated,service_role;

-- Keep legacy RPC names but route all writes through the versioned editor.
create or replace function public.admin_create_product(p_record jsonb) returns public.products
language plpgsql security definer set search_path=pg_catalog,public,auth,pg_temp as $$
begin
  return public.admin_save_catalogue_product(p_record->>'id',p_record-array['id','categoryId'],
    p_record->>'categoryId',true,null);
end $$;

create or replace function public.admin_update_product(p_id text,p_patch jsonb,p_is_visible boolean) returns public.products
language plpgsql security definer set search_path=pg_catalog,public,auth,pg_temp as $$
declare cat text;
begin
  if coalesce(public.current_admin_role(),'') not in ('ADMIN','SUPER_ADMIN') then raise exception 'Forbidden'; end if;
  if p_patch->>'expected' is null then raise exception 'Product changed'; end if;
  select category_id into cat from public.products where id=p_id;
  return public.admin_save_catalogue_product(p_id,p_patch-'expected',cat,p_is_visible,(p_patch->>'expected')::timestamptz);
end $$;
