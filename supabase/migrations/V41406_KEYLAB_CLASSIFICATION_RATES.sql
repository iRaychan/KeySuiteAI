-- KeySuite V4.14.06 — KeyLab classification rates synchronized to KeyLab V1.1.
-- Safe to run more than once.
-- Source-of-truth corrections: Keylargo 0%, Government 23%, Other 28%.
-- Blank / not-selected customer classification is handled by the frontend as Other.

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
    "clientMargin":{"Contractor":0.10,"End User":0.18,"Owner":0.18,"Keylargo":0,"Other":0.28,"Consultant":0.18,"OEM":0.05,"Distributor":0,"Dealer":0.05,"Government":0.23}
  }'::jsonb;

update public.ks_app_settings
set keylab_config = jsonb_set(
  coalesce(keylab_config, '{}'::jsonb),
  '{clientMargin}',
  coalesce(keylab_config->'clientMargin', '{}'::jsonb) ||
    '{"Keylargo":0,"Government":0.23,"Other":0.28}'::jsonb,
  true
)
where id='default';

commit;
