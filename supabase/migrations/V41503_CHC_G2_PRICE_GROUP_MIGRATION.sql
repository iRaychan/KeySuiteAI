-- KeySuite V4.15.03
-- Remove generic CHC OEM Price Group.
-- All old generic CHC OEM mappings are now CHC_G2.

begin;

do $$
begin
  if to_regclass('public.ks_oem_brand_family_map') is null then
    raise exception 'public.ks_oem_brand_family_map is missing.';
  end if;
  if to_regclass('public.ks_oem_brand_series') is null then
    raise exception 'public.ks_oem_brand_series is missing.';
  end if;
end
$$;

-- If an exact CHC_G2 mapping already exists, discard only the duplicate
-- legacy CHC row before conversion.
delete from public.ks_oem_brand_family_map legacy
using public.ks_oem_brand_family_map g2
where upper(coalesce(legacy.master_family,''))='CHC'
  and upper(coalesce(g2.master_family,''))='CHC_G2'
  and legacy.company_id=g2.company_id
  and legacy.brand_id=g2.brand_id
  and upper(coalesce(legacy.master_series,''))=upper(coalesce(g2.master_series,''))
  and upper(coalesce(legacy.selling_series,''))=upper(coalesce(g2.selling_series,''))
  and legacy.id<>g2.id;

update public.ks_oem_brand_family_map
set master_family='CHC_G2',
    updated_at=now()
where upper(coalesce(master_family,''))='CHC';

-- One Brand Series label per Price Group. Prefer an existing CHC_G2 row.
delete from public.ks_oem_brand_series legacy
using public.ks_oem_brand_series g2
where upper(coalesce(legacy.product_group,''))='CHC'
  and upper(coalesce(g2.product_group,''))='CHC_G2'
  and legacy.company_id=g2.company_id
  and legacy.brand_id=g2.brand_id;

update public.ks_oem_brand_series
set product_group='CHC_G2',
    updated_at=now()
where upper(coalesce(product_group,''))='CHC';

create or replace function public.keysuite_save_oem_series_mapping_v41503(p_mapping jsonb)
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
    raise exception 'Owner/Admin permission is required to manage OEM Price Groups.';
  end if;

  v_id:=nullif(p_mapping->>'id','');
  v_brand:=nullif(p_mapping->>'brand_id','');
  v_old_brand:=nullif(p_mapping->>'old_brand_id','');
  v_group:=upper(trim(coalesce(p_mapping->>'price_group_code',p_mapping->>'product_group_code',p_mapping->>'master_family','')));
  v_old_group:=upper(trim(coalesce(p_mapping->>'old_master_family','')));
  v_brand_series:=trim(coalesce(p_mapping->>'brand_series',''));
  v_master_series:=trim(coalesce(p_mapping->>'master_series',''));
  v_selling_series:=trim(coalesce(p_mapping->>'selling_series',''));
  v_active:=coalesce((p_mapping->>'active')::boolean,true);

  -- Backward compatibility: any caller still sending CHC means CHC G2.
  if v_group='CHC' then v_group:='CHC_G2'; end if;
  if v_old_group='CHC' then v_old_group:='CHC_G2'; end if;

  if v_id is null or v_brand is null then
    raise exception 'Mapping ID and Brand are required.';
  end if;

  if v_group not in ('CHC_G1','CHC_G2','ES','MOTOR') then
    raise exception 'Unsupported Price Group: %',v_group;
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
    'price_group_code',v_group,
    'base_family',case when v_group in ('CHC_G1','CHC_G2') then 'CHC' else v_group end,
    'generation_code',case when v_group='CHC_G1' then 'G1' when v_group='CHC_G2' then 'G2' else null end
  );
end
$$;

revoke all on function public.keysuite_save_oem_series_mapping_v41503(jsonb) from public,anon;
grant execute on function public.keysuite_save_oem_series_mapping_v41503(jsonb) to authenticated;

notify pgrst,'reload schema';

commit;
