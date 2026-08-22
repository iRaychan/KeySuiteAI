-- KeySuite V4.12.05 — KeyBot Sender Mode + Sender Assignment Authority
-- Run in the ONE KeySuite Supabase project. Safe to run more than once.

begin;

alter table public.ks_keyai_sender_customer_v40903
  add column if not exists response_mode text not null default 'nothing';

update public.ks_keyai_sender_customer_v40903
set response_mode='nothing'
where coalesce(response_mode,'') not in ('nothing','curve_only','curve_price');

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='ks_keyai_sender_response_mode_v41205_ck'
      and conrelid='public.ks_keyai_sender_customer_v40903'::regclass
  ) then
    alter table public.ks_keyai_sender_customer_v40903
      add constraint ks_keyai_sender_response_mode_v41205_ck
      check (response_mode in ('nothing','curve_only','curve_price'));
  end if;
end $$;

-- Add the new Sender assignment authority. Owner is always protected.
update public.ks_role_permissions rp
set permissions =
  case when lower(coalesce(rp.role,''))='owner' then
    coalesce(rp.permissions,'{}'::jsonb)
      || '{"keyai_access":"full","keyai_openai_control":"full","keyai_sender_assign":"full"}'::jsonb
  else
    coalesce(rp.permissions,'{}'::jsonb)
      || case
           when not (coalesce(rp.permissions,'{}'::jsonb) ? 'keyai_sender_assign')
             then '{"keyai_sender_assign":"none"}'::jsonb
           else '{}'::jsonb
         end
  end;

create or replace function public.keysuite_v41205_list_keybot_senders(p_company_id text)
returns table(
  sender_id text,
  sender_username text,
  sender_name text,
  customer_id text,
  customer_name text,
  pricing_category_id text,
  pricing_category_name text,
  assigned boolean,
  response_mode text,
  last_seen_at timestamptz
)
language plpgsql
stable
security definer
set search_path=public,auth
set row_security=off
as $$
declare
  v_company text := trim(coalesce(p_company_id,''));
begin
  if v_company='' or not public.keysuite_v409_has_company_access(v_company) then
    raise exception 'Your account has no active access to KeySuite company %.',coalesce(nullif(v_company,''),'(blank)');
  end if;
  if public.keysuite_keyai_permission_v41202(v_company,'keyai_access')='none' then
    raise exception 'Your role does not have KeyBot access.';
  end if;

  return query
  select
    s.sender_id,
    nullif(s.sender_username,'') as sender_username,
    nullif(s.sender_name,'') as sender_name,
    case when c.id is null then null else c.id::text end as customer_id,
    case when c.id is null then null else c.company_name::text end as customer_name,
    case when c.id is null or c.pricing_category_id is null then null else c.pricing_category_id::text end as pricing_category_id,
    case when pc.id is null then null else pc.category_name::text end as pricing_category_name,
    (c.id is not null) as assigned,
    case
      when coalesce(s.response_mode,'') in ('nothing','curve_only','curve_price') then s.response_mode
      else 'nothing'
    end as response_mode,
    s.last_seen_at
  from public.ks_keyai_sender_customer_v40903 s
  left join public.ks_customers c
    on c.id::text=coalesce(s.customer_id,'')
   and c.company_id::text=s.keysuite_company_id
   and coalesce(c.status,'active')='active'
  left join public.ks_pricing_categories pc
    on pc.id::text=coalesce(c.pricing_category_id::text,'')
  where s.keysuite_company_id=v_company
    and s.channel='telegram'
    and coalesce(s.active,true)=true
  order by s.last_seen_at desc, lower(coalesce(s.sender_name,s.sender_username,s.sender_id));
end;
$$;

create or replace function public.keysuite_v41205_assign_keybot_sender(
  p_company_id text,
  p_sender_id text,
  p_customer_id text,
  p_response_mode text
)
returns boolean
language plpgsql
security definer
set search_path=public,auth
set row_security=off
as $$
declare
  v_company text := trim(coalesce(p_company_id,''));
  v_sender text := trim(coalesce(p_sender_id,''));
  v_customer text := trim(coalesce(p_customer_id,''));
  v_mode text := lower(trim(coalesce(p_response_mode,'nothing')));
  v_actor text := lower(trim(coalesce(auth.jwt()->>'email','')));
begin
  if v_company='' or not public.keysuite_v409_has_company_access(v_company) then
    raise exception 'Your account has no active access to KeySuite company %.',coalesce(nullif(v_company,''),'(blank)');
  end if;
  if public.keysuite_keyai_permission_v41202(v_company,'keyai_sender_assign')='none' then
    raise exception 'Your role does not have KeyBot Sender assignment authority.';
  end if;
  if v_sender='' then raise exception 'Telegram sender ID is required.'; end if;
  if v_mode not in ('nothing','curve_only','curve_price') then
    raise exception 'Invalid Sender mode.';
  end if;

  if v_customer<>'' and not exists(
    select 1 from public.ks_customers c
    where c.id::text=v_customer
      and c.company_id::text=v_company
      and coalesce(c.status,'active')='active'
  ) then
    raise exception 'The selected customer does not belong to this KeySuite company.';
  end if;

  if v_mode='curve_price' and v_customer='' then
    raise exception 'Curve & Price requires an assigned company.';
  end if;

  if v_mode='curve_price' and not exists(
    select 1 from public.ks_customers c
    where c.id::text=v_customer
      and c.company_id::text=v_company
      and c.pricing_category_id is not null
      and coalesce(c.status,'active')='active'
  ) then
    raise exception 'Curve & Price requires the assigned company to have a pricing category.';
  end if;

  insert into public.ks_keyai_sender_customer_v40903(
    keysuite_company_id,channel,sender_id,customer_id,response_mode,active,
    assigned_by_email,first_seen_at,last_seen_at,created_at,updated_at
  )
  values(
    v_company,'telegram',v_sender,nullif(v_customer,''),v_mode,true,
    v_actor,now(),now(),now(),now()
  )
  on conflict(keysuite_company_id,channel,sender_id) do update
    set customer_id=excluded.customer_id,
        response_mode=excluded.response_mode,
        active=true,
        assigned_by_email=v_actor,
        updated_at=now();

  return true;
end;
$$;

revoke all on function public.keysuite_v41205_list_keybot_senders(text) from public,anon;
revoke all on function public.keysuite_v41205_assign_keybot_sender(text,text,text,text) from public,anon;
grant execute on function public.keysuite_v41205_list_keybot_senders(text) to authenticated;
grant execute on function public.keysuite_v41205_assign_keybot_sender(text,text,text,text) to authenticated;

-- Preserve the new Owner authority whenever the permission matrix is saved.
create or replace function public.keysuite_save_role_permissions_v40512(p_matrix jsonb)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
set row_security=off
as $$
declare
  v_company text := public.keysuite_current_company_text_v40404();
  v_email text := lower(coalesce(auth.jwt()->>'email',''));
  v_current_role text := '';
  v_role text;
  v_permissions jsonb;
  v_result jsonb := '{}'::jsonb;
begin
  select lower(coalesce(ua.role,'')) into v_current_role
  from public.ks_user_access ua
  where lower(ua.email)=v_email and ua.company_id::text=v_company and coalesce(ua.active,true)=true
  limit 1;

  if coalesce(v_company,'')='' or v_current_role<>'owner' then raise exception 'Access denied.'; end if;
  if p_matrix is null or jsonb_typeof(p_matrix)<>'object' then raise exception 'Invalid role permission matrix.'; end if;

  for v_role,v_permissions in select key,value from jsonb_each(p_matrix)
  loop
    v_role:=lower(trim(coalesce(v_role,'')));
    if v_role='' or v_role !~ '^[a-z0-9][a-z0-9_-]{0,39}$' then raise exception 'Invalid role name: %',v_role; end if;
    if jsonb_typeof(v_permissions)<>'object' then v_permissions:='{}'::jsonb; end if;
    if v_role='owner' then
      v_permissions:=coalesce(v_permissions,'{}'::jsonb)
        || '{"key_dashboard":"full","keyai_access":"full","keyai_openai_control":"full","keyai_sender_assign":"full","manage_roles":"full","use_quick_selection":"full","use_selector":"full","use_product":"full","choose_brand_series":"full","own_profile":"full"}'::jsonb;
    end if;

    if exists(
      select 1 from public.ks_role_permissions rp
      where rp.company_id::text=v_company and lower(coalesce(rp.role,''))=v_role
    ) then
      update public.ks_role_permissions rp
      set permissions=v_permissions
      where rp.company_id::text=v_company and lower(coalesce(rp.role,''))=v_role;
    else
      insert into public.ks_role_permissions(company_id,role,permissions)
      values(v_company,v_role,v_permissions);
    end if;

    v_result:=v_result||jsonb_build_object(v_role,v_permissions);
  end loop;

  return v_result;
end;
$$;

revoke all on function public.keysuite_save_role_permissions_v40512(jsonb) from public,anon;
grant execute on function public.keysuite_save_role_permissions_v40512(jsonb) to authenticated;

notify pgrst,'reload schema';

commit;
