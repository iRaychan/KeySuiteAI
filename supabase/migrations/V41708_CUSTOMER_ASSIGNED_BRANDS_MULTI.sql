-- KeySuite V4.17.08
-- Customer Assigned Brand becomes Customer Assigned Brands (multi-select).
-- Source is Owner-controlled and is independent from Price / Curve preferences.
--
-- Left Panel rule:
--   Role Brand Assigned ∩ Customer Assigned Brands
--
-- Empty Customer Assigned Brands = no Customer-level Brand restriction.

create table if not exists public.ks_customer_brand_scope_v41708 (
  company_id text not null,
  customer_id text not null,
  brand_ids jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by_email text,
  primary key (company_id, customer_id)
);

alter table public.ks_customer_brand_scope_v41708 enable row level security;

revoke all on table public.ks_customer_brand_scope_v41708 from public;
revoke all on table public.ks_customer_brand_scope_v41708 from anon;
revoke all on table public.ks_customer_brand_scope_v41708 from authenticated;

-- Preserve the previous single Brand assignment as the initial multi Brand scope.
do $$
begin
  if to_regclass('public.ks_customer_brand_assignments') is not null then
    execute $migrate$
      insert into public.ks_customer_brand_scope_v41708(
        company_id, customer_id, brand_ids, updated_at, updated_by_email
      )
      select
        company_id::text,
        customer_id::text,
        coalesce(jsonb_agg(distinct brand_id::text order by brand_id::text), '[]'::jsonb),
        now(),
        'legacy-migration'
      from public.ks_customer_brand_assignments
      where brand_id is not null
      group by company_id::text, customer_id::text
      on conflict (company_id, customer_id) do nothing
    $migrate$;
  end if;
end
$$;

create or replace function public.keysuite_list_customer_brand_scopes_v41708()
returns table (
  customer_id text,
  brand_ids jsonb
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_company text;
begin
  if auth.uid() is null or v_email = '' then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select ua.company_id::text
    into v_company
  from public.ks_user_access ua
  where lower(trim(coalesce(ua.email, ''))) = v_email
    and coalesce(ua.active, true) = true
  limit 1;

  if coalesce(v_company, '') = '' then
    raise exception 'Active KeySuite access was not found.' using errcode = '42501';
  end if;

  return query
  select s.customer_id, coalesce(s.brand_ids, '[]'::jsonb)
  from public.ks_customer_brand_scope_v41708 s
  where s.company_id = v_company
  order by s.customer_id;
end;
$$;

create or replace function public.keysuite_set_customer_brand_scope_v41708(
  p_customer_id text,
  p_brand_ids jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_company text;
  v_role text;
  v_customer_company text;
  v_ids jsonb;
begin
  if auth.uid() is null or v_email = '' then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select ua.company_id::text, lower(coalesce(ua.role, ''))
    into v_company, v_role
  from public.ks_user_access ua
  where lower(trim(coalesce(ua.email, ''))) = v_email
    and coalesce(ua.active, true) = true
  limit 1;

  if coalesce(v_company, '') = '' or v_role <> 'owner' then
    raise exception 'Only Owner can change Customer Assigned Brands.' using errcode = '42501';
  end if;

  select c.company_id::text
    into v_customer_company
  from public.ks_customers c
  where c.id::text = trim(coalesce(p_customer_id, ''))
    and coalesce(c.status, 'active') = 'active'
  limit 1;

  if coalesce(v_customer_company, '') = '' then
    raise exception 'Customer was not found.' using errcode = 'P0002';
  end if;

  if v_customer_company <> v_company then
    raise exception 'This customer belongs to another company.' using errcode = '42501';
  end if;

  -- Keep only:
  -- 1. active database Brands belonging to this company, or
  -- 2. permanent KeySuite house Brand IDs KEYLARGO / GWS.
  select coalesce(jsonb_agg(brand_id order by brand_id), '[]'::jsonb)
    into v_ids
  from (
    select distinct trim(value) as brand_id
    from jsonb_array_elements_text(
      case
        when jsonb_typeof(coalesce(p_brand_ids, '[]'::jsonb)) = 'array'
          then coalesce(p_brand_ids, '[]'::jsonb)
        else '[]'::jsonb
      end
    )
    where trim(value) <> ''
      and (
        upper(trim(value)) in ('KEYLARGO', 'GWS')
        or exists (
          select 1
          from public.ks_oem_brands b
          where b.company_id::text = v_company
            and b.id::text = trim(value)
            and coalesce(b.active, true) = true
        )
      )
  ) q;

  insert into public.ks_customer_brand_scope_v41708(
    company_id, customer_id, brand_ids, updated_at, updated_by_email
  )
  values (
    v_company, trim(p_customer_id), coalesce(v_ids, '[]'::jsonb), now(), v_email
  )
  on conflict (company_id, customer_id)
  do update set
    brand_ids = excluded.brand_ids,
    updated_at = excluded.updated_at,
    updated_by_email = excluded.updated_by_email;

  return coalesce(v_ids, '[]'::jsonb);
end;
$$;

revoke all on function public.keysuite_list_customer_brand_scopes_v41708() from public;
revoke all on function public.keysuite_set_customer_brand_scope_v41708(text,jsonb) from public;

grant execute on function public.keysuite_list_customer_brand_scopes_v41708() to authenticated;
grant execute on function public.keysuite_set_customer_brand_scope_v41708(text,jsonb) to authenticated;

comment on table public.ks_customer_brand_scope_v41708
is 'V4.17.08 Owner-controlled Customer Assigned Brands multi-select. Empty = no Customer Brand restriction.';
