-- KeySuite V4.14.13 — Brand Product Groups
--
-- Adds generation-aware Product Group support to OEM Brand mapping.
--
-- Supported CHC Product Groups:
--   CHC       = family CHC, no generation split
--   CHC_G1    = family CHC, generation G1
--   CHC_G2    = family CHC, generation G2
--
-- This does NOT modify CHC G2 curve, Product engine, Price List or PDF data.
--
-- Existing legacy mappings such as master_family='CHC' are preserved.
-- New CHC_G1 / CHC_G2 mappings can coexist because their product-group codes
-- are different values in master_family / product_group.

begin;

do $$
begin
  if to_regclass('public.ks_oem_brand_family_map') is null then
    raise exception 'public.ks_oem_brand_family_map is missing. Install the existing Brand/OEM schema first.';
  end if;
  if to_regclass('public.ks_oem_brand_series') is null then
    raise exception 'public.ks_oem_brand_series is missing. Install the existing Brand/OEM schema first.';
  end if;
  if to_regclass('public.ks_user_access') is null then
    raise exception 'public.ks_user_access is missing.';
  end if;
end
$$;

-- Remove only CHECK constraints that explicitly restrict the Product Group value.
-- Existing NOT NULL, PK, FK, UNIQUE and RLS rules are not touched.
do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    where c.conrelid='public.ks_oem_brand_family_map'::regclass
      and c.contype='c'
      and pg_get_constraintdef(c.oid) ilike '%master_family%'
      and pg_get_constraintdef(c.oid) ilike '%CHC%'
  loop
    execute format('alter table public.ks_oem_brand_family_map drop constraint if exists %I',r.conname);
  end loop;

  for r in
    select c.conname
    from pg_constraint c
    where c.conrelid='public.ks_oem_brand_series'::regclass
      and c.contype='c'
      and pg_get_constraintdef(c.oid) ilike '%product_group%'
      and pg_get_constraintdef(c.oid) ilike '%CHC%'
  loop
    execute format('alter table public.ks_oem_brand_series drop constraint if exists %I',r.conname);
  end loop;
end
$$;

create or replace function public.keysuite_save_oem_series_mapping_v41413(p_mapping jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_email text:=lower(trim(coalesce(auth.jwt()->>'email','')));
  v_company public.ks_oem_brand_family_map.company_id%type;
  v_id public.ks_oem_brand_family_map.id%type;
  v_brand public.ks_oem_brand_family_map.brand_id%type;
  v_old_brand public.ks_oem_brand_family_map.brand_id%type;
  v_group text;
  v_old_group text;
  v_brand_series text;
  v_master_series text;
  v_selling_series text;
  v_active boolean;
  v_count integer:=0;
begin
  select ua.company_id
  into v_company
  from public.ks_user_access ua
  where lower(coalesce(ua.email,''))=v_email
    and coalesce(ua.active,true)=true
    and lower(coalesce(ua.role,'')) in ('owner','admin')
  limit 1;

  if v_company is null then
    raise exception 'Owner/Admin permission is required to manage Brand Product Groups.';
  end if;

  v_id:=nullif(p_mapping->>'id','');
  v_brand:=nullif(p_mapping->>'brand_id','');
  v_old_brand:=nullif(p_mapping->>'old_brand_id','');
  v_group:=upper(trim(coalesce(p_mapping->>'product_group_code',p_mapping->>'master_family','')));
  v_old_group:=upper(trim(coalesce(p_mapping->>'old_master_family','')));
  v_brand_series:=trim(coalesce(p_mapping->>'brand_series',''));
  v_master_series:=trim(coalesce(p_mapping->>'master_series',''));
  v_selling_series:=trim(coalesce(p_mapping->>'selling_series',''));
  v_active:=coalesce((p_mapping->>'active')::boolean,true);

  if v_id is null or v_brand is null then
    raise exception 'Mapping ID and Brand are required.';
  end if;

  if v_group not in ('CHC','CHC_G1','CHC_G2','ES','MOTOR') then
    raise exception 'Unsupported Brand Product Group: %',v_group;
  end if;

  if v_brand_series='' or v_master_series='' or v_selling_series='' then
    raise exception 'Brand Series, Base Sub Series and Selling Sub Series are required.';
  end if;

  update public.ks_oem_brand_family_map
  set brand_id=v_brand,
      master_family=v_group,
      master_series=v_master_series,
      selling_series=v_selling_series,
      active=v_active,
      updated_at=now()
  where id=v_id and company_id=v_company;
  get diagnostics v_count=row_count;

  if v_count=0 then
    insert into public.ks_oem_brand_family_map
      (id,company_id,brand_id,master_family,master_series,selling_series,active,updated_at)
    values
      (v_id,v_company,v_brand,v_group,v_master_series,v_selling_series,v_active,now());
  end if;

  -- One Brand Series label per exact Product Group.
  update public.ks_oem_brand_series
  set brand_series=v_brand_series,
      active=v_active,
      updated_at=now()
  where company_id=v_company
    and brand_id=v_brand
    and upper(product_group)=v_group;
  get diagnostics v_count=row_count;

  if v_count=0 then
    insert into public.ks_oem_brand_series
      (company_id,brand_id,product_group,brand_series,active,updated_at)
    values
      (v_company,v_brand,v_group,v_brand_series,v_active,now());
  end if;

  -- If an existing row was moved from a different Brand/Product Group,
  -- remove the old Brand Series label only when no active mapping still uses it.
  if v_old_brand is not null
     and v_old_group<>''
     and (v_old_brand is distinct from v_brand or v_old_group is distinct from v_group)
     and not exists(
       select 1
       from public.ks_oem_brand_family_map m
       where m.company_id=v_company
         and m.brand_id=v_old_brand
         and upper(m.master_family)=v_old_group
         and coalesce(m.active,true)=true
     )
  then
    delete from public.ks_oem_brand_series
    where company_id=v_company
      and brand_id=v_old_brand
      and upper(product_group)=v_old_group;
  end if;

  return jsonb_build_object(
    'id',v_id,
    'brand_id',v_brand,
    'product_group_code',v_group,
    'base_family',case when v_group in ('CHC_G1','CHC_G2') then 'CHC' else v_group end,
    'generation_code',case when v_group='CHC_G1' then 'G1' when v_group='CHC_G2' then 'G2' else null end,
    'price_group_code',case when v_group in ('CHC_G1','CHC_G2') then v_group else case when v_group='CHC' then 'CHC' else v_group end end
  );
end
$$;

revoke all on function public.keysuite_save_oem_series_mapping_v41413(jsonb) from public,anon;
grant execute on function public.keysuite_save_oem_series_mapping_v41413(jsonb) to authenticated;

notify pgrst,'reload schema';

commit;
