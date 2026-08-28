-- KeySuite V4.14.10 — CHC G1 independent Price List verification

-- 1. G1 Price List model count must follow the supplied price workbook.
select count(*) as g1_price_models
from public.ks_products_chc_g1;
-- Expected: 374

-- 2. G1 must be an independent table, not G2-mapped prices.
select model,chc_usd,chcs_usd,chcn_usd,chc_rmb,chcs_rmb,chcn_rmb,chc_myr,chcs_myr,chcn_myr
from public.ks_products_chc_g1
order by source_row
limit 10;

-- 3. Supplied workbook prices were zero, therefore new initial rows are intentionally blank.
select
  count(*) filter (
    where coalesce(chc_usd,chcs_usd,chcn_usd,chc_rmb,chcs_rmb,chcn_rmb,chc_myr,chcs_myr,chcn_myr) is not null
  ) as rows_with_any_initial_price
from public.ks_products_chc_g1;
-- Expected immediately after first install: 0
-- Existing user-entered prices are preserved if this migration is rerun.

-- 4. RLS must be enabled.
select c.relname,c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname='ks_products_chc_g1';
-- Expected: true

-- 5. G1 hydraulic Selection remains disabled.
select family_code,generation_code,product_enabled,selection_enabled,app_editable
from public.ks_pump_generations_v41407
where family_code='CHC'
order by generation_code;
-- Expected G1: product_enabled=true, selection_enabled=false, app_editable=false

-- 6. G2 row count and price table are only read here; V4.14.10 does not update them.
select count(*) as g2_models from public.ks_products_chc;
