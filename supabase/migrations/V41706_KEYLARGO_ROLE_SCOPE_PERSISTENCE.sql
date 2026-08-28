-- KeySuite V4.17.06
-- Persist Role → Brand Assigned scopes, including the permanent virtual Keylargo:
-- KEYLARGO|*
-- KEYLARGO|BASEPLATE
-- KEYLARGO|COUPLING
-- KEYLARGO|KEYPLC
-- KEYLARGO|MANIFOLD
--
-- Existing normal Brand scopes remain compatible. The legacy V4.04.07 scope
-- functions are used as a fallback/migration source so current assignments remain.

create table if not exists public.ks_user_selection_scope_v41706 (
  company_id text not null,
  email text not null,
  selection_scope jsonb not null default '{"keys":[]}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by_email text,
  primary key (company_id, email)
);

alter table public.ks_user_selection_scope_v41706 enable row level security;

revoke all on table public.ks_user_selection_scope_v41706 from public;
revoke all on table public.ks_user_selection_scope_v41706 from anon;
revoke all on table public.ks_user_selection_scope_v41706 from authenticated;

create or replace function public.keysuite_set_user_selection_scope_v41706(
  p_email text,
  p_scope jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_actor_company text;
  v_actor_role text;
  v_target_email text := lower(trim(coalesce(p_email, '')));
  v_target_company text;
  v_keys jsonb;
  v_scope jsonb;
  v_legacy_keys jsonb;
  v_legacy_scope jsonb;
begin
  if auth.uid() is null or v_actor_email = '' then
    raise exception 'Authentication is required.'
      using errcode = '42501';
  end if;

  select ua.company_id::text, lower(coalesce(ua.role, ''))
    into v_actor_company, v_actor_role
  from public.ks_user_access ua
  where lower(trim(coalesce(ua.email, ''))) = v_actor_email
    and coalesce(ua.active, true) = true
  limit 1;

  if coalesce(v_actor_company, '') = '' or v_actor_role <> 'owner' then
    raise exception 'Owner permission is required to assign Brand / Series authority.'
      using errcode = '42501';
  end if;

  if v_target_email = '' then
    raise exception 'Target email is required.';
  end if;

  select ua.company_id::text
    into v_target_company
  from public.ks_user_access ua
  where lower(trim(coalesce(ua.email, ''))) = v_target_email
  limit 1;

  if coalesce(v_target_company, '') = '' then
    raise exception 'Target KeySuite user was not found.'
      using errcode = 'P0002';
  end if;

  if v_target_company <> v_actor_company then
    raise exception 'The target user belongs to another company.'
      using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(scope_key order by scope_key), '[]'::jsonb)
    into v_keys
  from (
    select distinct trim(value) as scope_key
    from jsonb_array_elements_text(
      case
        when jsonb_typeof(coalesce(p_scope -> 'keys', '[]'::jsonb)) = 'array'
          then coalesce(p_scope -> 'keys', '[]'::jsonb)
        else '[]'::jsonb
      end
    )
    where trim(value) <> ''
      and position('|' in trim(value)) > 1
  ) q;

  v_scope := jsonb_build_object('keys', coalesce(v_keys, '[]'::jsonb));

  insert into public.ks_user_selection_scope_v41706(
    company_id, email, selection_scope, updated_at, updated_by_email
  )
  values (
    v_actor_company, v_target_email, v_scope, now(), v_actor_email
  )
  on conflict (company_id, email)
  do update set
    selection_scope = excluded.selection_scope,
    updated_at = excluded.updated_at,
    updated_by_email = excluded.updated_by_email;

  -- Dual-write ordinary database Brand scopes to the legacy store.
  -- Virtual KEYLARGO scopes stay in the V4.17.06 store.
  select coalesce(jsonb_agg(scope_key order by scope_key), '[]'::jsonb)
    into v_legacy_keys
  from (
    select value as scope_key
    from jsonb_array_elements_text(v_scope -> 'keys')
    where upper(split_part(value, '|', 1)) <> 'KEYLARGO'
  ) legacy_q;

  v_legacy_scope := jsonb_build_object('keys', coalesce(v_legacy_keys, '[]'::jsonb));

  begin
    execute
      'select public.keysuite_set_user_selection_scope_v40407($1,$2)'
      using v_target_email, v_legacy_scope;
  exception
    when undefined_function then null;
    when others then null;
  end;

  return v_scope;
end;
$$;

create or replace function public.keysuite_get_my_selection_scope_v41706()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_company text;
  v_scope jsonb;
  v_legacy_text text;
begin
  if auth.uid() is null or v_email = '' then
    raise exception 'Authentication is required.'
      using errcode = '42501';
  end if;

  select ua.company_id::text
    into v_company
  from public.ks_user_access ua
  where lower(trim(coalesce(ua.email, ''))) = v_email
    and coalesce(ua.active, true) = true
  limit 1;

  if coalesce(v_company, '') = '' then
    raise exception 'Active KeySuite access was not found.'
      using errcode = '42501';
  end if;

  select s.selection_scope
    into v_scope
  from public.ks_user_selection_scope_v41706 s
  where s.company_id = v_company
    and s.email = v_email
  limit 1;

  if v_scope is not null then
    return v_scope;
  end if;

  -- Preserve current assignments from the old scope store and lazily migrate.
  begin
    execute
      'select public.keysuite_get_my_selection_scope_v40407()::text'
      into v_legacy_text;
  exception
    when undefined_function then v_legacy_text := null;
    when others then v_legacy_text := null;
  end;

  if coalesce(trim(v_legacy_text), '') <> '' then
    begin
      v_scope := v_legacy_text::jsonb;
    exception when others then
      v_scope := '{"keys":[]}'::jsonb;
    end;

    insert into public.ks_user_selection_scope_v41706(
      company_id, email, selection_scope, updated_at, updated_by_email
    )
    values (
      v_company, v_email, coalesce(v_scope, '{"keys":[]}'::jsonb), now(), 'legacy-migration'
    )
    on conflict (company_id, email) do nothing;

    return coalesce(v_scope, '{"keys":[]}'::jsonb);
  end if;

  return '{"keys":[]}'::jsonb;
end;
$$;

create or replace function public.keysuite_list_user_selection_scopes_v41706()
returns table (
  email text,
  selection_scope jsonb
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  v_company text;
  v_old_row jsonb;
  v_old_email text;
  v_old_scope jsonb;
  v_new record;
begin
  if auth.uid() is null or v_actor_email = '' then
    raise exception 'Authentication is required.'
      using errcode = '42501';
  end if;

  select ua.company_id::text
    into v_company
  from public.ks_user_access ua
  where lower(trim(coalesce(ua.email, ''))) = v_actor_email
    and coalesce(ua.active, true) = true
  limit 1;

  if coalesce(v_company, '') = '' then
    raise exception 'Active KeySuite access was not found.'
      using errcode = '42501';
  end if;

  -- Legacy same-company scopes first, but only when no V4.17.06 override exists.
  begin
    for v_old_row in execute
      'select to_jsonb(t) from public.keysuite_list_user_selection_scopes_v40407() t'
    loop
      v_old_email := lower(trim(coalesce(v_old_row ->> 'email', '')));
      v_old_scope := coalesce(v_old_row -> 'selection_scope', '{"keys":[]}'::jsonb);

      if v_old_email <> ''
         and exists (
           select 1
           from public.ks_user_access ua
           where lower(trim(coalesce(ua.email, ''))) = v_old_email
             and ua.company_id::text = v_company
         )
         and not exists (
           select 1
           from public.ks_user_selection_scope_v41706 s
           where s.company_id = v_company
             and s.email = v_old_email
         )
      then
        email := v_old_email;
        selection_scope := v_old_scope;
        return next;
      end if;
    end loop;
  exception
    when undefined_function then null;
    when others then null;
  end;

  -- V4.17.06 overrides always win, including permanent virtual Keylargo scopes.
  for v_new in
    select s.email, s.selection_scope
    from public.ks_user_selection_scope_v41706 s
    where s.company_id = v_company
    order by s.email
  loop
    email := v_new.email;
    selection_scope := v_new.selection_scope;
    return next;
  end loop;

  return;
end;
$$;

revoke all on function public.keysuite_set_user_selection_scope_v41706(text,jsonb) from public;
revoke all on function public.keysuite_get_my_selection_scope_v41706() from public;
revoke all on function public.keysuite_list_user_selection_scopes_v41706() from public;

grant execute on function public.keysuite_set_user_selection_scope_v41706(text,jsonb) to authenticated;
grant execute on function public.keysuite_get_my_selection_scope_v41706() to authenticated;
grant execute on function public.keysuite_list_user_selection_scopes_v41706() to authenticated;

comment on table public.ks_user_selection_scope_v41706
is 'KeySuite V4.17.06 persistent Role Brand Assigned scope, including virtual Keylargo authority keys.';
