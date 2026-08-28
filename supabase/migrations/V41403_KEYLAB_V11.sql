-- KeySuite V4.14.03 — KeyLab V1.1 customer-classification pricing.
-- Safe to run more than once. Preserves existing KeyLab source prices while
-- replacing the legacy Client Type margins with the V1.1 customer classifications.

begin;

alter table public.ks_app_settings
  add column if not exists keylab_config jsonb not null default '{
    "powerRate":5,
    "flowMeter":{"DN40":80,"DN65":130,"DN125":250,"DN250":500},
    "pressure":{"10 Bar":100,"16 Bar":160,"25 Bar":250},
    "inlet":{"DN65":130,"DN125":250,"DN150":300,"DN250":500},
    "labour":{"DN65":300,"DN125":500,"DN150":600,"DN250":800},
    "testEngineer":300,
    "accreditation":{"No":0,"Yes":500},
    "clientMargin":{"Contractor":0.10,"End User":0.18,"Owner":0.18,"Other":0.18,"Consultant":0.18,"OEM":0.05,"Distributor":0,"Dealer":0.05,"Government":0.23}
  }'::jsonb;

alter table public.ks_app_settings
  alter column keylab_config set default '{
    "powerRate":5,
    "flowMeter":{"DN40":80,"DN65":130,"DN125":250,"DN250":500},
    "pressure":{"10 Bar":100,"16 Bar":160,"25 Bar":250},
    "inlet":{"DN65":130,"DN125":250,"DN150":300,"DN250":500},
    "labour":{"DN65":300,"DN125":500,"DN150":600,"DN250":800},
    "testEngineer":300,
    "accreditation":{"No":0,"Yes":500},
    "clientMargin":{"Contractor":0.10,"End User":0.18,"Owner":0.18,"Other":0.18,"Consultant":0.18,"OEM":0.05,"Distributor":0,"Dealer":0.05,"Government":0.23}
  }'::jsonb;

update public.ks_app_settings
set keylab_config =
  jsonb_set(
    jsonb_set(
      coalesce(keylab_config, '{}'::jsonb),
      '{accreditation}',
      jsonb_build_object(
        'No', 0,
        'Yes', coalesce(
          (keylab_config->'accreditation'->>'Yes')::numeric,
          (keylab_config->'accreditation'->>'Accredited')::numeric,
          500
        )
      ),
      true
    ),
    '{clientMargin}',
    '{"Contractor":0.10,"End User":0.18,"Owner":0.18,"Other":0.18,"Consultant":0.18,"OEM":0.05,"Distributor":0,"Dealer":0.05,"Government":0.23}'::jsonb,
    true
  )
where id='default';

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
