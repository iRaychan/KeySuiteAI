-- KeySuite V4.12.16 - per-user Pump Selection Display Settings
begin;

create table if not exists public.ks_selector_display_settings (
  user_id uuid not null references auth.users(id) on delete cascade,
  selector_family text not null,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, selector_family),
  constraint ks_selector_display_settings_family_ck check (selector_family in ('CHC','ES'))
);

alter table public.ks_selector_display_settings enable row level security;

drop policy if exists ks_selector_display_settings_select_own on public.ks_selector_display_settings;
create policy ks_selector_display_settings_select_own
on public.ks_selector_display_settings for select to authenticated
using (auth.uid() = user_id);

drop policy if exists ks_selector_display_settings_insert_own on public.ks_selector_display_settings;
create policy ks_selector_display_settings_insert_own
on public.ks_selector_display_settings for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists ks_selector_display_settings_update_own on public.ks_selector_display_settings;
create policy ks_selector_display_settings_update_own
on public.ks_selector_display_settings for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists ks_selector_display_settings_delete_own on public.ks_selector_display_settings;
create policy ks_selector_display_settings_delete_own
on public.ks_selector_display_settings for delete to authenticated
using (auth.uid() = user_id);

grant select,insert,update,delete on public.ks_selector_display_settings to authenticated;
commit;
