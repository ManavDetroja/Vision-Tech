# Product editor migration preflight

**Disposition: tested locally; pending explicit approval for staging.**

Version `20261122000300` follows `20261122000200_notification_delivery.sql`. SHA-256 of the tested file: `31EF51010C7A573BE825633B37A0A8498A1109C5C53E2F6296790AA7D7FF5D54`.

The disposable stack applied all nine migrations in filename order. This migration requires public.products, public.admin_activity, public.current_admin_role(), auth.uid(), and the standard Supabase roles. The only data update archives a previously excluded model if it is still visible. The CHECK constraint protects future writes by all paths. PostgreSQL must lock products to validate the constraint. The new RPC returns public.products and writes product data and actor activity in one transaction. It locks and version-checks existing products before updates. The definer function restricts the active role and pins search_path. PUBLIC and anon have no execute grant. Existing product and service RLS policies and historical RPCs are preserved.

Before any hosted run, independently confirm the staging project, the eight prerequisite ledger entries, the SHA-256, recovery coverage and the expected single pending migration with a dry run. Review any visible rows that would be archived. After any separately approved rollout, verify the new version, constraint, function definition, access control and public inventory. PostgreSQL can roll back a failed migration transaction. Reverting a successful deployment or reactivating an excluded product would require a separately reviewed change. No hosted ledger or hosted deployment was tested in this milestone.

## Exact reviewed SQL

```sql
-- Preserve legacy rows and identity. Excluded stock can only remain archived.
update public.products set is_visible = false
where is_visible and upper(btrim(model)) in ('CP-Z42Q','CP-UNC-DA41L3C-Q2','CP-DNW-HPU8G2-6-V3');
alter table public.products add constraint products_excluded_models_hidden
check (not is_visible or upper(btrim(model)) not in ('CP-Z42Q','CP-UNC-DA41L3C-Q2','CP-DNW-HPU8G2-6-V3'));

create function public.admin_save_catalogue_product(
  p_id text, p_changes jsonb, p_category text, p_visible boolean, p_expected timestamptz
) returns public.products language plpgsql security definer
set search_path = pg_catalog, public, auth, pg_temp as $$
declare
  existing public.products;
  saved public.products;
  category_sub text := coalesce(p_changes->>'subcategory','');
begin
  if coalesce(public.current_admin_role(),'') not in ('ADMIN','SUPER_ADMIN') then raise exception 'Forbidden'; end if;
  if p_id is null or p_id !~ '^[a-z0-9][a-z0-9-]{0,99}$' or p_visible is null
    or jsonb_typeof(p_changes) is distinct from 'object' or p_changes ?| array['id','categoryId','modelNumber']
    or not coalesce(case p_category
      when 'ip-cameras' then category_sub in ('','Dome Cameras','Bullet Cameras')
      when 'wi-fi-cameras' then category_sub in ('','PT Cameras')
      when '4g-cameras' then category_sub in ('','Dome Cameras','Bullet Cameras','PT Cameras')
      when 'solar-products' then category_sub in ('','Solar Panel Kits')
      when 'nvr' then category_sub=''
      when 'poe-switches' then category_sub=''
      else false end,false) then raise exception 'Invalid product'; end if;
  if p_expected is null then
    if p_changes->>'model' is null or p_changes->>'model' !~ '^[A-Z0-9][A-Z0-9-]{0,99}$'
      or lower(p_changes->>'model') <> p_id then raise exception 'Invalid model'; end if;
    insert into public.products(id,model,category_id,record,is_visible,updated_by)
    values(p_id,p_changes->>'model',p_category,p_changes || jsonb_build_object('id',p_id,'categoryId',p_category),p_visible,auth.uid()) returning * into saved;
  else
    if p_changes ? 'model' then raise exception 'Product identity fields cannot be changed'; end if;
    select * into existing from public.products where id=p_id for update;
    if not found or existing.updated_at <> p_expected then raise exception 'Product changed'; end if;
    update public.products set category_id=p_category,record=record || p_changes || jsonb_build_object('categoryId',p_category),
      is_visible=p_visible,updated_at=clock_timestamp(),updated_by=auth.uid() where id=p_id returning * into saved;
  end if;
  insert into public.admin_activity(actor_id,action,entity_type,details)
  values(auth.uid(),case when p_expected is null then 'PRODUCT_CREATED' else 'PRODUCT_UPDATED' end,'PRODUCT',jsonb_build_object('productId',p_id));
  return saved;
end;
$$;
revoke all on function public.admin_save_catalogue_product(text,jsonb,text,boolean,timestamptz) from public,anon;
grant execute on function public.admin_save_catalogue_product(text,jsonb,text,boolean,timestamptz) to authenticated;
```
