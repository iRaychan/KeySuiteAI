-- KeySuite V4.14.12 verification

select
  category_name,
  product_rules ? 'CHC_G1' as has_chc_g1,
  product_rules ? 'CHC_G2' as has_chc_g2
from public.ks_pricing_categories
order by category_name;
-- Expected: both TRUE for every category.

select
  category_name,
  product_rules->'CHC_G1' as chc_g1,
  product_rules->'CHC_G2' as chc_g2
from public.ks_pricing_categories
order by category_name;

select
  category_name,
  product_rules->'CHC' as legacy_chc,
  product_rules->'CHC_G2' as chc_g2
from public.ks_pricing_categories
order by category_name;
