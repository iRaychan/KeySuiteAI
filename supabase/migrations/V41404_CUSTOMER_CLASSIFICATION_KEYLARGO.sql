-- KeySuite V4.14.04 — Customer Classification: Keylargo + blank follows Other.
-- Safe to run more than once. Existing KeyLab values are preserved.

begin;

alter table public.ks_app_settings
  alter column keylab_config set default '{
    "powerRate":5,
    "flowMeter":{"DN40":80,"DN65":130,"DN125":250,"DN250":500},
    "pressure":{"10 Bar":100,"16 Bar":160,"25 Bar":250},
    "inlet":{"DN65":130,"DN125":250,"DN150":300,"DN250":500},
    "labour":{"DN65":300,"DN125":500,"DN150":600,"DN250":800},
    "testEngineer":300,
    "accreditation":{"No":0,"Yes":500},
    "clientMargin":{"Contractor":0.10,"End User":0.18,"Owner":0.18,"Keylargo":0.18,"Other":0.18,"Consultant":0.18,"OEM":0.05,"Distributor":0,"Dealer":0.05,"Government":0.23}
  }'::jsonb;

update public.ks_app_settings
set keylab_config = jsonb_set(
  coalesce(keylab_config, '{}'::jsonb),
  '{clientMargin}',
  coalesce(keylab_config->'clientMargin', '{}'::jsonb) ||
    jsonb_build_object(
      'Keylargo',
      coalesce(
        (keylab_config->'clientMargin'->>'Keylargo')::numeric,
        (keylab_config->'clientMargin'->>'Other')::numeric,
        0.18
      )
    ),
  true
)
where id='default';

commit;
