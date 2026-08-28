-- KeySuite V4.17.10 verification
select
  to_regclass('public.ks_customer_brand_price_preference_v41710') as preference_table;

select
  p.proname as function_name,
  p.prosecdef as security_definer,
  pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname in (
    'keysuite_get_customer_price_preference_v41710',
    'keysuite_save_customer_price_preference_v41710'
  )
order by p.proname;
