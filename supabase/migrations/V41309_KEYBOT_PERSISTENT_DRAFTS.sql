-- KeySuite V4.13.09 — Persistent KeyBot quotation drafts + secure Saved quotation bridge
-- Run once in the existing KeySuite Supabase project before deploying V4.13.09 telegram-webhook.
-- Safe to run more than once.

begin;

create table if not exists public.ks_keybot_quote_drafts_v41309 (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,
  channel text not null default 'telegram',
  chat_id text not null,
  sender_id text not null,
  user_email text not null,
  customer_id text not null,
  customer_name text not null,
  items jsonb not null default '[]'::jsonb,
  status text not null default 'active' check (status in ('active','converted','cancelled')),
  converted_quotation_id text,
  converted_quotation_no text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ks_keybot_quote_drafts_v41309_sender_idx
  on public.ks_keybot_quote_drafts_v41309(company_id,channel,sender_id,updated_at desc);
create index if not exists ks_keybot_quote_drafts_v41309_active_idx
  on public.ks_keybot_quote_drafts_v41309(company_id,user_email,status,updated_at desc);

alter table public.ks_keybot_quote_drafts_v41309 enable row level security;
revoke all on table public.ks_keybot_quote_drafts_v41309 from anon,authenticated;
grant select,insert,update,delete on table public.ks_keybot_quote_drafts_v41309 to service_role;

create or replace function public.keysuite_v41309_create_saved_quotation(
  p_user_email text,
  p_customer_id text,
  p_quotation jsonb
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
  v_company text;
  v_role text;
  v_view text := 'assigned';
  v_allowed boolean := false;
  v_prefix text := '';
  v_profile_prefix text := '';
  v_prefix_row jsonb := '{}'::jsonb;
  v_now timestamp := now() at time zone 'Asia/Kuala_Lumpur';
  v_yy text := to_char(v_now,'YY');
  v_yymm text := to_char(v_now,'YYMM');
  v_running integer := 0;
  v_no text;
  v_id text;
  v_clean jsonb;
  v_saved jsonb := '{}'::jsonb;
  v_permission jsonb := '{}'::jsonb;
begin
  if v_email='' then raise exception 'Linked KeySuite user email is required.'; end if;
  if v_customer='' then raise exception 'Customer ID is required.'; end if;

  select u.id into v_uid from auth.users u
  where lower(trim(coalesce(u.email,'')))=v_email limit 1;
  if v_uid is null then raise exception 'Linked KeySuite user was not found in Supabase Auth.'; end if;

  select ua.company_id::text, lower(trim(coalesce(ua.role,'user')))
    into v_company,v_role
  from public.ks_user_access ua
  where lower(trim(ua.email))=v_email and coalesce(ua.active,false)=true
  limit 1;
  if coalesce(v_company,'')='' then raise exception 'Linked KeySuite user has no active company access.'; end if;

  if v_role in ('owner','admin') then
    v_view := 'all';
  else
    begin
      select coalesce(r.permissions,'{}'::jsonb) into v_permission
      from public.ks_role_permissions r
      where r.company_id::text=v_company and lower(trim(r.role))=v_role
      limit 1;
      v_view := lower(coalesce(v_permission->>'view_customers','assigned'));
    exception when others then
      v_view := 'assigned';
    end;
  end if;

  if v_view='all' then
    select exists(select 1 from public.ks_customers c where c.id::text=v_customer and c.company_id::text=v_company and coalesce(c.status,'active')='active') into v_allowed;
  elsif v_view<>'none' then
    select exists(select 1 from public.ks_customers c where c.id::text=v_customer and c.company_id::text=v_company and coalesce(c.status,'active')='active' and lower(trim(coalesce(c.assigned_user_email,'')))=v_email) into v_allowed;
  end if;
  if not v_allowed then raise exception 'This customer is not available under the linked KeySuite user access.'; end if;

  -- Recreate the linked user's authenticated identity so the established KeySuite
  -- quotation functions apply the same company/security rules as the browser.
  perform set_config('request.jwt.claim.sub',v_uid::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_uid::text,'email',v_email,'role','authenticated')::text,true);

  begin
    select upper(trim(coalesce(p.quotation_prefix,''))) into v_profile_prefix
    from public.ks_user_profiles p where lower(trim(p.email))=v_email limit 1;
  exception when others then v_profile_prefix := ''; end;
  v_prefix := coalesce(v_profile_prefix,'');

  if v_prefix='' and to_regprocedure('public.keysuite_get_quotation_prefix_v223()') is not null then
    begin
      execute 'select to_jsonb(x) from public.keysuite_get_quotation_prefix_v223() x limit 1' into v_prefix_row;
      v_prefix := upper(trim(coalesce(v_prefix_row->>'quotation_prefix',v_prefix_row->>'quotationPrefix','')));
    exception when others then v_prefix := ''; end;
  end if;
  if v_prefix='' then raise exception 'No quotation prefix is assigned to %.',v_email; end if;
  if v_prefix !~ '^[A-Z0-9]{1,8}$' then raise exception 'The assigned quotation prefix is invalid.'; end if;

  -- KeySuite running number is annual; month is part of the displayed reference.
  select coalesce(max((regexp_match(a.quotation_no,'^[A-Z0-9]{1,8}-[0-9]{4}-([0-9]{1,4})(?:-R[0-9]+)?$'))[1]::integer),0)
    into v_running
  from public.ks_quotation_archive_v409 a
  where a.company_id=v_company and upper(a.quotation_no) like v_prefix||'-'||v_yy||'%-' || '%';

  loop
    v_running := v_running + 1;
    if v_running>9999 then raise exception 'Quotation running number has reached 9999 for %.',v_prefix; end if;
    v_no := v_prefix||'-'||v_yymm||'-'||lpad(v_running::text,4,'0');
    exit when not exists(select 1 from public.ks_quotation_archive_v409 a where a.company_id=v_company and upper(a.quotation_no)=v_no);
  end loop;

  v_id := trim(coalesce(p_quotation->>'id',gen_random_uuid()::text));
  v_clean := coalesce(p_quotation,'{}'::jsonb)
    || jsonb_build_object(
      'id',v_id,'companyId',v_company,'company_id',v_company,'no',v_no,
      'date',coalesce(nullif(p_quotation->>'date',''),to_char(v_now,'YYYY-MM-DD')),
      'documentType','Quotation','customerId',v_customer,'pricingCustomerId',v_customer,
      'status','saved','createdByEmail',v_email,'updatedByEmail',v_email,
      'createdAt',coalesce(nullif(p_quotation->>'createdAt',''),now()::text),'updatedAt',now()::text
    );

  if to_regprocedure('public.keysuite_save_quotation_v409(text,jsonb)') is null then
    raise exception 'keysuite_save_quotation_v409 is not installed.';
  end if;
  select row_data into v_saved from public.keysuite_save_quotation_v409(v_company,v_clean) limit 1;

  -- Keep the browser's quotation-reference counter synchronized where available.
  if to_regprocedure('public.keysuite_register_quotation_reference_v226(text)') is not null then
    begin
      execute 'select public.keysuite_register_quotation_reference_v226($1)' using v_no;
    exception when others then null;
    end;
  end if;

  return coalesce(v_saved,v_clean) || jsonb_build_object('no',v_no,'id',v_id,'status','saved');
end;
$$;

revoke all on function public.keysuite_v41309_create_saved_quotation(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.keysuite_v41309_create_saved_quotation(text,text,jsonb) to service_role;

notify pgrst,'reload schema';
commit;
