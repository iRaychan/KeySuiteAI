-- KeySuite V4.17.08 verification
select
  to_regclass('public.ks_customer_brand_scope_v41708') as customer_brand_scope_table,
  to_regprocedure('public.keysuite_list_customer_brand_scopes_v41708()') as list_rpc,
  to_regprocedure('public.keysuite_set_customer_brand_scope_v41708(text,jsonb)') as save_rpc;

select company_id, customer_id, brand_ids, updated_at, updated_by_email
from public.ks_customer_brand_scope_v41708
order by updated_at desc
limit 30;
