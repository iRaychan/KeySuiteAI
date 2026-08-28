-- KeySuite V4.13 — KeyBot guided menu + internal quotation customer search
-- Run in the ONE KeySuite Supabase project after the V4.12.x migrations.
-- Safe to run more than once.

begin;

-- Keep the old Sender -> Customer mapping for legacy customer-facing modes,
-- and add an independent Sender -> KeySuite User link for the new internal
-- quotation assistant. These are deliberately separate identities.
alter table public.ks_keyai_sender_customer_v40903
  add column if not exists keysuite_user_email text;

create index if not exists ks_keyai_sender_user_v41300_idx
  on public.ks_keyai_sender_customer_v40903(keysuite_company_id,lower(keysuite_user_email))
  where nullif(trim(keysuite_user_email),'') is not null;

create table if not exists public.ks_keybot_sessions_v41300 (
  keysuite_company_id text not null,
  channel text not null default 'telegram',
  chat_id text not null,
  sender_id text not null,
  mode text not null default '',
  step text not null default 'idle',
  flow_m3h numeric,
  head_m numeric,
  flow_raw text,
  head_raw text,
  selected_customer_id text,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (keysuite_company_id,channel,chat_id,sender_id)
);

create index if not exists ks_keybot_sessions_v41300_updated_idx
  on public.ks_keybot_sessions_v41300(updated_at desc);

alter table public.ks_keybot_sessions_v41300 enable row level security;
revoke all on table public.ks_keybot_sessions_v41300 from anon,authenticated;

-- Sender list for the KeySuite KeyBot admin screen.
create or replace function public.keysuite_v41300_list_keybot_senders(p_company_id text)
returns table(
  sender_id text,
  sender_username text,
  sender_name text,
  keysuite_user_email text,
  keysuite_user_name text,
  keysuite_user_role text,
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
    nullif(lower(trim(coalesce(s.keysuite_user_email,''))),'') as keysuite_user_email,
    nullif(ua.display_name,'') as keysuite_user_name,
    nullif(lower(trim(coalesce(ua.role,''))),'') as keysuite_user_role,
    case when c.id is null then null else c.id::text end as customer_id,
    case when c.id is null then null else c.company_name::text end as customer_name,
    case when c.id is null or c.pricing_category_id is null then null else c.pricing_category_id::text end as pricing_category_id,
    case when pc.id is null then null else pc.category_name::text end as pricing_category_name,
    (c.id is not null) as assigned,
    case when coalesce(s.response_mode,'') in ('nothing','curve_only','curve_price') then s.response_mode else 'nothing' end as response_mode,
    s.last_seen_at
  from public.ks_keyai_sender_customer_v40903 s
  left join public.ks_user_access ua
    on lower(trim(ua.email))=lower(trim(coalesce(s.keysuite_user_email,'')))
   and ua.company_id::text=s.keysuite_company_id
   and coalesce(ua.active,false)=true
  left join public.ks_customers c
    on c.id::text=coalesce(s.customer_id,'')
   and c.company_id::text=s.keysuite_company_id
   and coalesce(c.status,'active')='active'
  left join public.ks_pricing_categories pc
    on pc.id::text=coalesce(c.pricing_category_id::text,'')
  where s.keysuite_company_id=v_company
    and s.channel='telegram'
    and coalesce(s.active,true)=true
  order by s.last_seen_at desc,lower(coalesce(s.sender_name,s.sender_username,s.sender_id));
end;
$$;

create or replace function public.keysuite_v41300_list_keybot_users(p_company_id text)
returns table(email text,display_name text,role text)
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
    raise exception 'Your account has no active access to this KeySuite company.';
  end if;
  if public.keysuite_keyai_permission_v41202(v_company,'keyai_sender_assign')='none' then
    raise exception 'Your role does not have KeyBot Sender assignment authority.';
  end if;
  return query
  select lower(trim(ua.email)),coalesce(nullif(trim(ua.display_name),''),lower(trim(ua.email))),lower(trim(coalesce(ua.role,'user')))
  from public.ks_user_access ua
  where ua.company_id::text=v_company and coalesce(ua.active,false)=true
  order by lower(coalesce(nullif(trim(ua.display_name),''),ua.email));
end;
$$;

create or replace function public.keysuite_v41300_assign_keybot_sender(
  p_company_id text,
  p_sender_id text,
  p_user_email text,
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
  v_user text := lower(trim(coalesce(p_user_email,'')));
  v_customer text := trim(coalesce(p_customer_id,''));
  v_mode text := lower(trim(coalesce(p_response_mode,'nothing')));
  v_actor text := lower(trim(coalesce(auth.jwt()->>'email','')));
begin
  if v_company='' or not public.keysuite_v409_has_company_access(v_company) then
    raise exception 'Your account has no active access to this KeySuite company.';
  end if;
  if public.keysuite_keyai_permission_v41202(v_company,'keyai_sender_assign')='none' then
    raise exception 'Your role does not have KeyBot Sender assignment authority.';
  end if;
  if v_sender='' then raise exception 'Telegram sender ID is required.'; end if;
  if v_mode not in ('nothing','curve_only','curve_price') then raise exception 'Invalid Sender mode.'; end if;

  if v_user<>'' and not exists(
    select 1 from public.ks_user_access ua
    where ua.company_id::text=v_company and lower(trim(ua.email))=v_user and coalesce(ua.active,false)=true
  ) then
    raise exception 'The selected KeySuite user is not active in this company.';
  end if;

  if v_customer<>'' and not exists(
    select 1 from public.ks_customers c
    where c.id::text=v_customer and c.company_id::text=v_company and coalesce(c.status,'active')='active'
  ) then
    raise exception 'The selected customer does not belong to this KeySuite company.';
  end if;

  if v_mode='curve_price' and v_customer='' then raise exception 'Curve & Price requires an assigned company.'; end if;
  if v_mode='curve_price' and not exists(
    select 1 from public.ks_customers c
    where c.id::text=v_customer and c.company_id::text=v_company and c.pricing_category_id is not null and coalesce(c.status,'active')='active'
  ) then
    raise exception 'Curve & Price requires the assigned company to have a pricing category.';
  end if;

  insert into public.ks_keyai_sender_customer_v40903(
    keysuite_company_id,channel,sender_id,keysuite_user_email,customer_id,response_mode,active,
    assigned_by_email,first_seen_at,last_seen_at,created_at,updated_at
  ) values(
    v_company,'telegram',v_sender,nullif(v_user,''),nullif(v_customer,''),v_mode,true,
    v_actor,now(),now(),now(),now()
  )
  on conflict(keysuite_company_id,channel,sender_id) do update
  set keysuite_user_email=excluded.keysuite_user_email,
      customer_id=excluded.customer_id,
      response_mode=excluded.response_mode,
      active=true,
      assigned_by_email=v_actor,
      updated_at=now();
  return true;
end;
$$;

revoke all on function public.keysuite_v41300_list_keybot_senders(text) from public,anon;
revoke all on function public.keysuite_v41300_list_keybot_users(text) from public,anon;
revoke all on function public.keysuite_v41300_assign_keybot_sender(text,text,text,text,text) from public,anon;
grant execute on function public.keysuite_v41300_list_keybot_senders(text) to authenticated;
grant execute on function public.keysuite_v41300_list_keybot_users(text) to authenticated;
grant execute on function public.keysuite_v41300_assign_keybot_sender(text,text,text,text,text) to authenticated;

notify pgrst,'reload schema';
commit;
