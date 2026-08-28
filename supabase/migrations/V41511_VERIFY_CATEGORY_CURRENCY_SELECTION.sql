-- KeySuite V4.15.11 verification. Missing / [] means 0 selected.
select category_name,
 coalesce(product_rules->'CHC_G1'->'currencies','[]'::jsonb) as chc_g1,
 coalesce(product_rules->'CHC_G2'->'currencies','[]'::jsonb) as chc_g2,
 coalesce(product_rules->'ES'->'currencies','[]'::jsonb) as es,
 coalesce(product_rules->'GWS'->'currencies','[]'::jsonb) as gws,
 coalesce(product_rules->'KEYPLC'->'currencies','[]'::jsonb) as keyplc,
 coalesce(product_rules->'MANIFOLD'->'currencies','[]'::jsonb) as manifold,
 coalesce(product_rules->'MOTOR'->'currencies','[]'::jsonb) as motor,
 coalesce(product_rules->'COUPLING'->'currencies','[]'::jsonb) as coupling,
 coalesce(product_rules->'BASEPLATE'->'currencies','[]'::jsonb) as baseplate
from public.ks_pricing_categories order by category_name;
