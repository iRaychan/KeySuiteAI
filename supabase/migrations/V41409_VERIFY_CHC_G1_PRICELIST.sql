-- KeySuite V4.14.09 — verification

-- 1) G1/G2 flags.
select family_code,generation_code,is_active,data_ready,
       product_enabled,selection_enabled,app_editable
from public.ks_pump_generations_v41407
where family_code='CHC'
order by generation_code;

-- Expected:
-- G1: product_enabled=true, selection_enabled=false, app_editable=false
-- G2: product_enabled=true, selection_enabled=true

-- 2) G1 count must remain 409.
select count(*) as g1_models
from public.ks_chc_generation_models_v41408
where generation_code='G1';

-- Expected: 409

-- 3) Read-only G1 Price List projection.
select
  count(*) as g1_price_list_models,
  count(*) filter (where source_missing) as mapped_g2_source_missing
from public.keysuite_v41409_chc_g1_pricelist();

-- Expected g1_price_list_models: 409.
-- Ideally mapped_g2_source_missing = 0 for the production price table.

-- 4) Hydraulic Selection must still expose G2 only.
select * from public.keysuite_v41407_list_pump_generations('CHC');

-- 5) RLS status.
select c.relname as table_name,c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public'
  and c.relname in (
    'ks_pump_generations_v41407',
    'ks_chc_generation_models_v41408',
    'ks_chc_g1_model_dimensions_v41408',
    'ks_chc_g1_variant_dimensions_v41408',
    'ks_chc_g1_price_source_v41408',
    'ks_chc_g1_mech_seal_source_v41408'
  )
order by c.relname;
-- Expected: all true.
