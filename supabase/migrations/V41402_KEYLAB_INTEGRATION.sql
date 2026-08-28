-- KeySuite V4.14.02 — KeyLab integrated price list.
-- Safe to run more than once.

begin;

alter table public.ks_app_settings
  add column if not exists keylab_config jsonb not null default '{
    "powerRate":5,
    "flowMeter":{"DN40":80,"DN65":130,"DN125":250,"DN250":500},
    "pressure":{"10 Bar":100,"16 Bar":160,"25 Bar":250},
    "inlet":{"DN65":130,"DN125":250,"DN150":300,"DN250":500},
    "labour":{"DN65":300,"DN125":500,"DN150":600,"DN250":800},
    "testEngineer":300,
    "accreditation":{"Not Accredited":0,"Accredited":500},
    "clientMargin":{"Laboratory":0,"Pump Related":0.05,"Contractor":0.10,"Owner":0.18}
  }'::jsonb;

update public.ks_app_settings
set keylab_config = '{
    "powerRate":5,
    "flowMeter":{"DN40":80,"DN65":130,"DN125":250,"DN250":500},
    "pressure":{"10 Bar":100,"16 Bar":160,"25 Bar":250},
    "inlet":{"DN65":130,"DN125":250,"DN150":300,"DN250":500},
    "labour":{"DN65":300,"DN125":500,"DN150":600,"DN250":800},
    "testEngineer":300,
    "accreditation":{"Not Accredited":0,"Accredited":500},
    "clientMargin":{"Laboratory":0,"Pump Related":0.05,"Contractor":0.10,"Owner":0.18}
  }'::jsonb
where id='default' and (keylab_config is null or keylab_config='{}'::jsonb);

create or replace function public.keysuite_save_keylab_pricelist_v41402(p_config jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_role text;
  v_saved jsonb;
begin
  select lower(coalesce(u.email,'')) into v_email from auth.users u where u.id=auth.uid();
  select lower(coalesce(a.role,'')) into v_role
  from public.ks_user_access a
  where lower(a.email)=v_email and coalesce(a.active,false)=true
  limit 1;

  if coalesce(v_role,'') <> 'owner' then
    raise exception 'Owner permission is required to maintain KeyLab Price List.';
  end if;

  if p_config is null or jsonb_typeof(p_config) <> 'object' then
    raise exception 'KeyLab configuration must be a JSON object.';
  end if;

  update public.ks_app_settings
  set keylab_config=p_config
  where id='default'
  returning keylab_config into v_saved;

  if v_saved is null then
    raise exception 'KeySuite app settings row "default" was not found.';
  end if;
  return v_saved;
end;
$$;

revoke all on function public.keysuite_save_keylab_pricelist_v41402(jsonb) from public;
grant execute on function public.keysuite_save_keylab_pricelist_v41402(jsonb) to authenticated;

commit;
