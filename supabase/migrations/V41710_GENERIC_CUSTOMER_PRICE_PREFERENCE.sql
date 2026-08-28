-- KeySuite V4.17.10
-- Generic Customer Brand / Series Price Preference persistence.
--
-- WHY:
-- The older V3.96.3 save RPC predates virtual / non-hydraulic product keys
-- such as KEYLARGO|COUPLING, GWS|GWS and M.O.S Motor. V4.17.10 stores the
-- complete preference JSON centrally without hard-coding Brand or Series keys.
--
-- Existing legacy preferences are lazily imported on first read.

begin;

create table if not exists public.ks_customer_brand_price_preference_v41710 (
  company_id text not null,
  customer_id text not null,
  selection jsonb not null default '{"keys":[],"price_keys":[],"brand_enabled":{}}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by_email text,
  primary key (company_id, customer_id)
);

create index if not exists ks_customer_brand_price_preference_v41710_customer_idx
  on public.ks_customer_brand_price_preference_v41710(customer_id);

alter table public.ks_customer_brand_price_preference_v41710 enable row level security;

revoke all on table public.ks_customer_brand_price_preference_v41710 from public, anon, authenticated;
grant select, insert, update, delete on table public.ks_customer_brand_price_preference_v41710 to service_role;

-- Read helper: same active KeySuite company only.
create or replace function public.keysuite_get_customer_price_preference_v41710(
  p_customer_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
set row_security = off
as $$
declare
  v_customer text := trim(coalesce(p_customer_id,''));
  v_email text := lower(trim(coalesce(auth.jwt()->>'email','')));
  v_company text := '';
  v_customer_company text := '';
  v_saved jsonb;
  v_legacy_text text;
begin
  if auth.uid() is null or v_email='' then
    raise exception 'Authentication is required.' using errcode='42501';
  end if;
  if v_customer='' then
    raise exception 'Customer ID is required.';
  end if;

  select ua.company_id::text
    into v_company
  from public.ks_user_access ua
  where lower(trim(coalesce(ua.email,'')))=v_email
    and coalesce(ua.active,false)=true
  limit 1;

  if coalesce(v_company,'')='' then
    raise exception 'Active KeySuite access was not found.' using errcode='42501';
  end if;

  select c.company_id::text
    into v_customer_company
  from public.ks_customers c
  where c.id::text=v_customer
    and coalesce(c.status,'active')='active'
  limit 1;

  if coalesce(v_customer_company,'')='' then
    raise exception 'Customer was not found.' using errcode='P0002';
  end if;
  if v_customer_company<>v_company then
    raise exception 'This customer belongs to another company.' using errcode='42501';
  end if;

  select p.selection
    into v_saved
  from public.ks_customer_brand_price_preference_v41710 p
  where p.company_id=v_company
    and p.customer_id=v_customer
  limit 1;

  if v_saved is not null then
    return v_saved;
  end if;

  -- Lazy migration from the existing central preference store.
  begin
    if to_regprocedure('public.keysuite_get_customer_quick_preference_v3963(text)') is not null then
      execute
        'select public.keysuite_get_customer_quick_preference_v3963($1)::text'
        into v_legacy_text
        using v_customer;
    end if;
  exception when others then
    v_legacy_text := null;
  end;

  if coalesce(trim(v_legacy_text),'')<>'' then
    begin
      v_saved := v_legacy_text::jsonb;
      if jsonb_typeof(v_saved)='object' then
        insert into public.ks_customer_brand_price_preference_v41710(
          company_id, customer_id, selection, updated_by_email
        )
        values(v_company,v_customer,v_saved,v_email)
        on conflict(company_id,customer_id) do nothing;
        return v_saved;
      end if;
    exception when others then
      null;
    end;
  end if;

  return null;
end;
$$;

-- Save helper: Owner or Role permission customer_settings=full.
-- Keys are intentionally generic TEXT values; no Brand/Series whitelist is used.
create or replace function public.keysuite_save_customer_price_preference_v41710(
  p_customer_id text,
  p_selection jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
set row_security = off
as $$
declare
  v_customer text := trim(coalesce(p_customer_id,''));
  v_email text := lower(trim(coalesce(auth.jwt()->>'email','')));
  v_company text := '';
  v_customer_company text := '';
  v_role text := '';
  v_permission text := 'none';
  v_keys jsonb := '[]'::jsonb;
  v_price_keys jsonb := '[]'::jsonb;
  v_brand_enabled jsonb := '{}'::jsonb;
  v_clean jsonb := '{}'::jsonb;
begin
  if auth.uid() is null or v_email='' then
    raise exception 'Authentication is required.' using errcode='42501';
  end if;
  if v_customer='' then
    raise exception 'Customer ID is required.';
  end if;
  if p_selection is null or jsonb_typeof(p_selection)<>'object' then
    raise exception 'Brand / Series Price Preference must be a JSON object.';
  end if;

  select ua.company_id::text, lower(trim(coalesce(ua.role,'')))
    into v_company, v_role
  from public.ks_user_access ua
  where lower(trim(coalesce(ua.email,'')))=v_email
    and coalesce(ua.active,false)=true
  limit 1;

  if coalesce(v_company,'')='' then
    raise exception 'Active KeySuite access was not found.' using errcode='42501';
  end if;

  select c.company_id::text
    into v_customer_company
  from public.ks_customers c
  where c.id::text=v_customer
    and coalesce(c.status,'active')='active'
  limit 1;

  if coalesce(v_customer_company,'')='' then
    raise exception 'Customer was not found.' using errcode='P0002';
  end if;
  if v_customer_company<>v_company then
    raise exception 'This customer belongs to another company.' using errcode='42501';
  end if;

  if v_role='owner' then
    v_permission := 'full';
  else
    select lower(trim(coalesce(rp.permissions->>'customer_settings','none')))
      into v_permission
    from public.ks_role_permissions rp
    where rp.company_id::text=v_company
      and lower(trim(coalesce(rp.role,'')))=v_role
    limit 1;
    v_permission := coalesce(nullif(v_permission,''),'none');
  end if;

  if v_permission not in ('full','all') then
    raise exception 'Your role does not have Full access to Key → Customer.'
      using errcode='42501';
  end if;

  if jsonb_typeof(p_selection->'keys')='array' then
    select coalesce(jsonb_agg(x.value order by x.value),'[]'::jsonb)
      into v_keys
    from (
      select distinct trim(value) as value
      from jsonb_array_elements_text(p_selection->'keys')
      where trim(value)<>''
    ) x;
  end if;

  if jsonb_typeof(p_selection->'price_keys')='array' then
    select coalesce(jsonb_agg(x.value order by x.value),'[]'::jsonb)
      into v_price_keys
    from (
      select distinct trim(value) as value
      from jsonb_array_elements_text(p_selection->'price_keys')
      where trim(value)<>''
    ) x;
  end if;

  if jsonb_typeof(p_selection->'brand_enabled')='object' then
    v_brand_enabled := p_selection->'brand_enabled';
  end if;

  -- Preserve any future JSON fields while normalizing the three established fields.
  v_clean := p_selection || jsonb_build_object(
    'keys',v_keys,
    'price_keys',v_price_keys,
    'brand_enabled',v_brand_enabled
  );

  insert into public.ks_customer_brand_price_preference_v41710(
    company_id,customer_id,selection,created_at,updated_at,updated_by_email
  )
  values(v_company,v_customer,v_clean,now(),now(),v_email)
  on conflict(company_id,customer_id) do update
    set selection=excluded.selection,
        updated_at=now(),
        updated_by_email=v_email;

  return v_clean;
end;
$$;

revoke all on function public.keysuite_get_customer_price_preference_v41710(text) from public, anon;
revoke all on function public.keysuite_save_customer_price_preference_v41710(text,jsonb) from public, anon;

grant execute on function public.keysuite_get_customer_price_preference_v41710(text) to authenticated;
grant execute on function public.keysuite_save_customer_price_preference_v41710(text,jsonb) to authenticated;

comment on table public.ks_customer_brand_price_preference_v41710
is 'KeySuite V4.17.10 generic Customer Brand / Series Price Preference store.';

comment on function public.keysuite_get_customer_price_preference_v41710(text)
is 'V4.17.10 same-company generic Customer Brand / Series Price Preference read with lazy legacy migration.';

comment on function public.keysuite_save_customer_price_preference_v41710(text,jsonb)
is 'V4.17.10 generic Customer Brand / Series Price Preference save; Owner or customer_settings Full.';

notify pgrst,'reload schema';

commit;
