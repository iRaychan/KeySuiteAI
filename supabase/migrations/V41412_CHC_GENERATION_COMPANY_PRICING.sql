-- KeySuite V4.14.12 — CHC G1 / G2 Company & Pricing split
-- Existing CHC rule becomes CHC G2.
-- G1 receives a one-time starting copy, then G1/G2 are independent.
-- Safe to run more than once. Existing CHC_G1 / CHC_G2 values are preserved.

begin;

do $$
begin
  if to_regclass('public.ks_pricing_categories') is null then
    raise exception 'public.ks_pricing_categories was not found.';
  end if;
end
$$;

update public.ks_pricing_categories
set product_rules =
  jsonb_set(
    jsonb_set(
      coalesce(product_rules,'{}'::jsonb),
      '{CHC_G2}',
      coalesce(
        product_rules->'CHC_G2',
        product_rules->'CHC',
        jsonb_build_object(
          'margin',coalesce(chc_margin,chc_factor,0.38),
          'normal',0,
          'rare',0,
          'transport',coalesce(transport,30),
          'useCommission',true,
          'useSetDiscount',true,
          'useFinalDiscount',true,
          'useFuelCharge',true
        )
      ),
      true
    ),
    '{CHC_G1}',
    coalesce(
      product_rules->'CHC_G1',
      product_rules->'CHC',
      jsonb_build_object(
        'margin',coalesce(chc_margin,chc_factor,0.38),
        'normal',0,
        'rare',0,
        'transport',coalesce(transport,30),
        'useCommission',true,
        'useSetDiscount',true,
        'useFinalDiscount',true,
        'useFuelCharge',true
      )
    ),
    true
  );

create or replace function public.keysuite_save_chc_generation_category_rule_v41412(
  p_category_id text,
  p_category_name text,
  p_product_code text,
  p_margin numeric,
  p_normal numeric,
  p_rare numeric,
  p_transport numeric,
  p_use_commission boolean,
  p_use_set_discount boolean,
  p_use_final_discount boolean,
  p_use_fuel_charge boolean
)
returns boolean
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_email text:=lower(trim(coalesce(auth.jwt()->>'email','')));
  v_code text:=upper(trim(coalesce(p_product_code,'')));
  v_rule jsonb;
  v_count integer:=0;
begin
  if not exists(
    select 1 from public.ks_user_access ua
    where lower(coalesce(ua.email,''))=v_email
      and lower(coalesce(ua.role,''))='owner'
      and coalesce(ua.active,true)=true
  ) then
    raise exception 'Owner permission is required to change pricing-category rules.';
  end if;

  if v_code not in ('CHC_G1','CHC_G2') then
    raise exception 'Only CHC_G1 or CHC_G2 is accepted.';
  end if;

  if coalesce(trim(p_category_id),'')='' then
    raise exception 'Save the Pricing Category first, then set the CHC generation rule.';
  end if;

  if p_margin is null or p_margin<0 or p_margin>=1
     or p_normal is null or p_normal<0 or p_normal>=1
     or p_rare is null or p_rare<0 or p_rare>=1 then
    raise exception 'Margin / Normal / Rare must be from 0%% to below 100%%.';
  end if;

  if p_transport is null or p_transport<0 then
    raise exception 'Transport must be RM0.00 or more.';
  end if;

  v_rule:=jsonb_build_object(
    'margin',p_margin,
    'normal',p_normal,
    'rare',p_rare,
    'transport',p_transport,
    'useCommission',coalesce(p_use_commission,false),
    'useSetDiscount',coalesce(p_use_set_discount,false),
    'useFinalDiscount',coalesce(p_use_final_discount,false),
    'useFuelCharge',coalesce(p_use_fuel_charge,false)
  );

  if v_code='CHC_G1' then
    update public.ks_pricing_categories
    set category_name=coalesce(nullif(trim(p_category_name),''),category_name),
        product_rules=jsonb_set(coalesce(product_rules,'{}'::jsonb),'{CHC_G1}',v_rule,true)
    where id::text=p_category_id;
    get diagnostics v_count=row_count;
  else
    update public.ks_pricing_categories
    set category_name=coalesce(nullif(trim(p_category_name),''),category_name),
        product_rules=jsonb_set(
          jsonb_set(coalesce(product_rules,'{}'::jsonb),'{CHC_G2}',v_rule,true),
          '{CHC}',v_rule,true
        ),
        chc_margin=p_margin,
        transport=p_transport
    where id::text=p_category_id;
    get diagnostics v_count=row_count;
  end if;

  if v_count<>1 then
    raise exception 'Pricing Category was not found.';
  end if;

  return true;
end
$$;

revoke all on function public.keysuite_save_chc_generation_category_rule_v41412(
  text,text,text,numeric,numeric,numeric,numeric,boolean,boolean,boolean,boolean
) from public,anon;

grant execute on function public.keysuite_save_chc_generation_category_rule_v41412(
  text,text,text,numeric,numeric,numeric,numeric,boolean,boolean,boolean,boolean
) to authenticated;

notify pgrst,'reload schema';

commit;
