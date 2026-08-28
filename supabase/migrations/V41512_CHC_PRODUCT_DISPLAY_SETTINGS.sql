-- KeySuite V4.15.12
-- Product -> CHC G2 -> Curve gets its own saved Display Settings namespace.

begin;

do $$
begin
  if to_regclass('public.ks_selector_display_settings') is null then
    raise exception 'public.ks_selector_display_settings does not exist. Run V41216_SELECTOR_DISPLAY_SETTINGS.sql first.';
  end if;
end
$$;

alter table public.ks_selector_display_settings
  drop constraint if exists ks_selector_display_settings_family_ck;

alter table public.ks_selector_display_settings
  add constraint ks_selector_display_settings_family_ck
  check (selector_family in ('CHC','ES','CHC_PRODUCT'));

commit;
