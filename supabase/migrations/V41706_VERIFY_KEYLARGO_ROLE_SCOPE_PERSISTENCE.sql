-- KeySuite V4.17.06 verification
select
  to_regclass('public.ks_user_selection_scope_v41706') as scope_table,
  to_regprocedure('public.keysuite_set_user_selection_scope_v41706(text,jsonb)') as save_rpc,
  to_regprocedure('public.keysuite_get_my_selection_scope_v41706()') as my_scope_rpc,
  to_regprocedure('public.keysuite_list_user_selection_scopes_v41706()') as list_rpc;

select company_id, email, selection_scope, updated_at, updated_by_email
from public.ks_user_selection_scope_v41706
order by updated_at desc
limit 20;
