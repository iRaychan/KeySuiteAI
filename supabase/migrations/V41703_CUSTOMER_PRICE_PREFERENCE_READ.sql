-- KeySuite V4.17.03
-- Customer Price Preference must be central Customer data, not browser-local data.
-- This safe wrapper allows an authenticated user in the SAME KeySuite company
-- to read the existing V3.96.3 Customer preference saved by the Owner.
--
-- It intentionally does NOT grant editing. Saving remains controlled by the
-- existing keysuite_save_customer_quick_preference_v3963 function.

create or replace function public.keysuite_get_customer_quick_preference_v41703(
  p_customer_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_user_company text;
  v_customer_company text;
  v_result_text text;
begin
  if auth.uid() is null or v_email = '' then
    raise exception 'Authentication is required.'
      using errcode = '42501';
  end if;

  select ua.company_id::text
    into v_user_company
  from public.ks_user_access ua
  where lower(ua.email) = v_email
    and coalesce(ua.active, false) = true
  limit 1;

  if coalesce(v_user_company, '') = '' then
    raise exception 'Active KeySuite access was not found.'
      using errcode = '42501';
  end if;

  select c.company_id::text
    into v_customer_company
  from public.ks_customers c
  where c.id = p_customer_id
    and coalesce(c.status, 'active') = 'active'
  limit 1;

  if coalesce(v_customer_company, '') = '' then
    raise exception 'Customer was not found.'
      using errcode = 'P0002';
  end if;

  if v_customer_company <> v_user_company then
    raise exception 'This customer belongs to another company.'
      using errcode = '42501';
  end if;

  -- Call the existing central preference getter under this SECURITY DEFINER
  -- context. Support either UUID or TEXT legacy signatures.
  if to_regprocedure('public.keysuite_get_customer_quick_preference_v3963(uuid)') is not null then
    execute
      'select public.keysuite_get_customer_quick_preference_v3963($1)::text'
      into v_result_text
      using p_customer_id;
  elsif to_regprocedure('public.keysuite_get_customer_quick_preference_v3963(text)') is not null then
    execute
      'select public.keysuite_get_customer_quick_preference_v3963($1)::text'
      into v_result_text
      using p_customer_id::text;
  else
    raise exception 'Existing Customer preference getter keysuite_get_customer_quick_preference_v3963 is not installed.'
      using errcode = '42883';
  end if;

  if v_result_text is null or btrim(v_result_text) = '' then
    return null;
  end if;

  return v_result_text::jsonb;
end;
$$;

revoke all on function public.keysuite_get_customer_quick_preference_v41703(uuid) from public;
grant execute on function public.keysuite_get_customer_quick_preference_v41703(uuid) to authenticated;

comment on function public.keysuite_get_customer_quick_preference_v41703(uuid)
is 'V4.17.03 same-company SECURITY DEFINER read wrapper for centrally stored Customer Brand/Series Price Preference.';
