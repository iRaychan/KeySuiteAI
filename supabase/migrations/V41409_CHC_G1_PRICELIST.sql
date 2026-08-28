-- KeySuite V4.14.09 — CHC G1 Price List + RLS hardening
-- Upgrade from V4.14.08.
--
-- CONFIRMED:
--   * CHC G2 stays unchanged.
--   * CHC G1 stays Product-enabled, hydraulic-Selection-disabled and app read-only.
--   * CHC G1 Price List is read-only.
--   * G1 price/rarity follows its mapped G2 source model.
--   * No quotation/PDF layout is changed.
--
-- Safe to run more than once.

begin;

do $$
begin
  if to_regclass('public.ks_chc_generation_models_v41408') is null then
    raise exception 'V4.14.08 CHC G1 production data is missing. Run V41408_CHC_G1_PRODUCTION.sql first.';
  end if;
  if to_regclass('public.ks_products_chc') is null then
    raise exception 'Existing CHC G2 price table public.ks_products_chc was not found.';
  end if;
end
$$;

-- Keep generation policy explicit in production.
alter table public.ks_pump_generations_v41407 enable row level security;

drop policy if exists ks_pump_generations_v41409_read
on public.ks_pump_generations_v41407;

create policy ks_pump_generations_v41409_read
on public.ks_pump_generations_v41407
for select to authenticated
using (true);

revoke all on public.ks_pump_generations_v41407 from anon,authenticated;
grant select on public.ks_pump_generations_v41407 to authenticated;

-- Re-assert G1 production flags.
update public.ks_pump_generations_v41407
set is_active=true,
    data_ready=true,
    product_enabled=true,
    selection_enabled=false,
    app_editable=false,
    updated_at=now()
where family_code='CHC'
  and generation_code='G1';

-- Re-assert G2 without changing its data.
update public.ks_pump_generations_v41407
set is_active=true,
    data_ready=true,
    product_enabled=true,
    selection_enabled=true,
    updated_at=now()
where family_code='CHC'
  and generation_code='G2';

-- Read-only backend Price List projection.
-- The frontend also carries the same G1->G2 model map locally, so CHC G1
-- remains visible even when only the existing secure G2 price payload is loaded.
create or replace function public.keysuite_v41409_chc_g1_pricelist()
returns table(
  generation_code text,
  model_code text,
  equivalent_model_code text,
  source_product_id text,
  source_missing boolean,
  chc_usd numeric,
  chcs_usd numeric,
  chcn_usd numeric,
  chc_rmb numeric,
  chcs_rmb numeric,
  chcn_rmb numeric,
  chc_myr numeric,
  chcs_myr numeric,
  chcn_myr numeric,
  chc_rarity_usd text,
  chcs_rarity_usd text,
  chcn_rarity_usd text,
  chc_rarity_rmb text,
  chcs_rarity_rmb text,
  chcn_rarity_rmb text,
  chc_rarity_myr text,
  chcs_rarity_myr text,
  chcn_rarity_myr text
)
language sql
stable
security definer
set search_path=public
as $$
  select
    'G1'::text,
    g.model_code::text,
    g.equivalent_model_code::text,
    p.id::text,
    (p.id is null)::boolean,
    p.chc_usd::numeric,
    p.chcs_usd::numeric,
    p.chcn_usd::numeric,
    p.chc_rmb::numeric,
    p.chcs_rmb::numeric,
    p.chcn_rmb::numeric,
    p.chc_myr::numeric,
    p.chcs_myr::numeric,
    p.chcn_myr::numeric,
    p.chc_rarity_usd::text,
    p.chcs_rarity_usd::text,
    p.chcn_rarity_usd::text,
    p.chc_rarity_rmb::text,
    p.chcs_rarity_rmb::text,
    p.chcn_rarity_rmb::text,
    p.chc_rarity_myr::text,
    p.chcs_rarity_myr::text,
    p.chcn_rarity_myr::text
  from public.ks_chc_generation_models_v41408 g
  left join public.ks_products_chc p
    on lower(trim(p.model))=lower(trim(g.equivalent_model_code))
  where g.generation_code='G1'
    and g.product_enabled=true
  order by g.family_no,g.stage_no,g.model_code
$$;

revoke all on function public.keysuite_v41409_chc_g1_pricelist()
from public,anon;
grant execute on function public.keysuite_v41409_chc_g1_pricelist()
to authenticated;

-- G1 reference tables remain read-only to authenticated app users.
alter table public.ks_chc_generation_models_v41408 enable row level security;
alter table public.ks_chc_g1_model_dimensions_v41408 enable row level security;
alter table public.ks_chc_g1_variant_dimensions_v41408 enable row level security;
alter table public.ks_chc_g1_price_source_v41408 enable row level security;
alter table public.ks_chc_g1_mech_seal_source_v41408 enable row level security;

revoke insert,update,delete,truncate,references,trigger
on public.ks_chc_generation_models_v41408,
   public.ks_chc_g1_model_dimensions_v41408,
   public.ks_chc_g1_variant_dimensions_v41408,
   public.ks_chc_g1_price_source_v41408,
   public.ks_chc_g1_mech_seal_source_v41408
from authenticated;

notify pgrst,'reload schema';

commit;
