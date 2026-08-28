-- KeySuite V4.17.05
-- FIX: KeySuite Customer IDs are text IDs such as COID00001, not UUIDs.
-- This migration replaces the bad V4.17.03 UUID wrapper with a TEXT-ID wrapper.

drop function if exists public.keysuite_get_customer_quick_preference_v41703(uuid);

create or replace function public.keysuite_get_customer_quick_preference_v41705(
  p_customer_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
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
  where lower(trim(coalesce(ua.email, ''))) = v_email
    and coalesce(ua.active, true) = true
  limit 1;

  if coalesce(v_user_company, '') = '' then
    raise exception 'Active KeySuite access was not found.'
      using errcode = '42501';
  end if;

  select c.company_id::text
    into v_customer_company
  from public.ks_customers c
  where c.id::text = trim(p_customer_id)
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

  -- Existing KeySuite customer preference storage already accepts COID text IDs.
  -- Call that central getter under SECURITY DEFINER after same-company validation.
  if to_regprocedure('public.keysuite_get_customer_quick_preference_v3963(text)') is not null then
    execute
      'select public.keysuite_get_customer_quick_preference_v3963($1)::text'
      into v_result_text
      using trim(p_customer_id);
  else
    raise exception 'Existing Customer preference getter keysuite_get_customer_quick_preference_v3963(text) is not installed.'
      using errcode = '42883';
  end if;

  if v_result_text is null or btrim(v_result_text) = '' then
    return null;
  end if;

  return v_result_text::jsonb;
end;
$$;

revoke all on function public.keysuite_get_customer_quick_preference_v41705(text) from public;
grant execute on function public.keysuite_get_customer_quick_preference_v41705(text) to authenticated;

comment on function public.keysuite_get_customer_quick_preference_v41705(text)
is 'V4.17.05 same-company Customer Brand/Series Price Preference read for KeySuite text Customer IDs such as COID00001.';
