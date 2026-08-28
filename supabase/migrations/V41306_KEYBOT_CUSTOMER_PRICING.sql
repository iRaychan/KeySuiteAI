-- KeySuite V4.13.06 — KeyBot exact customer pricing bridge
-- Run once in the existing KeySuite Supabase project before deploying V4.13.06 telegram-webhook.
-- This bridge reuses the exact V2.22 customer-specific pricing row used by normal KeySuite.

begin;

create or replace function public.keysuite_v41306_get_customer_pricing(
  p_user_email text,
  p_customer_id text
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
set row_security=off
as $$
declare
  v_email text := lower(trim(coalesce(p_user_email,'')));
  v_customer text := trim(coalesce(p_customer_id,''));
  v_uid uuid;
  v_row jsonb;
begin
  if v_email='' then raise exception 'Linked KeySuite user email is required.'; end if;
  if v_customer='' then raise exception 'Customer ID is required.'; end if;

  select u.id into v_uid
  from auth.users u
  where lower(trim(coalesce(u.email,'')))=v_email
  limit 1;
  if v_uid is null then raise exception 'Linked KeySuite user was not found in Supabase Auth.'; end if;

  if to_regprocedure('public.keysuite_get_customer_pricing_v222()') is null then
    raise exception 'keysuite_get_customer_pricing_v222 is not installed. Run the existing V2.22 customer pricing migration first.';
  end if;

  -- Recreate the authenticated identity that the browser uses for the linked KeySuite user.
  perform set_config('request.jwt.claim.sub',v_uid::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub',v_uid::text,'email',v_email,'role','authenticated')::text,
    true
  );

  select to_jsonb(x) into v_row
  from public.keysuite_get_customer_pricing_v222() x
  where coalesce(to_jsonb(x)->>'customer_id',to_jsonb(x)->>'customerId','')=v_customer
  limit 1;

  -- Same behavior as the normal UI when no customer-specific row has been saved.
  return coalesce(v_row,jsonb_build_object(
    'customer_id',v_customer,
    'commission',0,
    'set_discount',0,
    'final_discount',0
  ));
end;
$$;

revoke all on function public.keysuite_v41306_get_customer_pricing(text,text) from public,anon,authenticated;
grant execute on function public.keysuite_v41306_get_customer_pricing(text,text) to service_role;

notify pgrst,'reload schema';
commit;
