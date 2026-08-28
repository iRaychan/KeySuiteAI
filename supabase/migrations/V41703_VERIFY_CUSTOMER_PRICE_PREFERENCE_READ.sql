-- KeySuite V4.17.03 verification
select
  p.proname as function_name,
  p.prosecdef as security_definer,
  pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'keysuite_get_customer_quick_preference_v41703';
