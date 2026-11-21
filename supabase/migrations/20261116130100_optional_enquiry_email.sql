-- Pending explicit staging approval. Preserve existing NOT NULL column; absent email is empty text.
create or replace function public.submit_public_enquiry(p_payload jsonb, p_idempotency_key uuid, p_rate_hash text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, auth, pg_temp
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
  if char_length(btrim(coalesce(p_payload->>'email', ''))) > 254 or (btrim(coalesce(p_payload->>'email', '')) <> '' and btrim(coalesce(p_payload->>'email', '')) !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise exception 'Invalid email'; end if;
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
      p_idempotency_key, btrim(p_payload->>'name'), lower(btrim(coalesce(p_payload->>'email', ''))), btrim(v_phone), v_type,
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

