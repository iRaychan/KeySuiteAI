-- KeySuite V4.14.13 — Brand Product Group verification

-- 1. Show exact Product Groups by Brand.
select
  b.brand_name,
  m.master_family as product_group_code,
  case
    when upper(m.master_family) in ('CHC_G1','CHC_G2') then 'CHC'
    else upper(m.master_family)
  end as base_family,
  case
    when upper(m.master_family)='CHC_G1' then 'G1'
    when upper(m.master_family)='CHC_G2' then 'G2'
    else null
  end as generation_code,
  m.master_series,
  m.selling_series,
  m.active
from public.ks_oem_brand_family_map m
join public.ks_oem_brands b on b.id=m.brand_id
order by b.brand_name,m.master_family,m.master_series;

-- 2. CHC G1 and CHC G2 may coexist under the same Brand.
select
  b.brand_name,
  count(*) filter (where upper(m.master_family)='CHC_G1') as chc_g1_rows,
  count(*) filter (where upper(m.master_family)='CHC_G2') as chc_g2_rows
from public.ks_oem_brands b
left join public.ks_oem_brand_family_map m on m.brand_id=b.id
group by b.brand_name
order by b.brand_name;

-- 3. Existing generic CHC rows are preserved and remain valid.
select count(*) as legacy_chc_rows
from public.ks_oem_brand_family_map
where upper(master_family)='CHC';
