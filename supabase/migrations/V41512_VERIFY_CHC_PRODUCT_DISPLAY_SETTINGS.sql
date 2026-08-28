-- KeySuite V4.15.12 verification
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid='public.ks_selector_display_settings'::regclass
  and conname='ks_selector_display_settings_family_ck';
