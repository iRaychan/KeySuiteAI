-- KeySuite V4.15.03 verification

-- Must be zero after migration.
select count(*) as legacy_chc_mapping_rows
from public.ks_oem_brand_family_map
where upper(coalesce(master_family,''))='CHC';

select count(*) as legacy_chc_brand_series_rows
from public.ks_oem_brand_series
where upper(coalesce(product_group,''))='CHC';

-- Current CHC Price Groups.
select
  b.brand_name,
  m.master_family as price_group,
  m.master_series as base_sub_series,
  m.selling_series,
  m.active
from public.ks_oem_brand_family_map m
join public.ks_oem_brands b on b.id=m.brand_id
where upper(m.master_family) in ('CHC_G1','CHC_G2')
order by b.brand_name,m.master_family,m.master_series;
