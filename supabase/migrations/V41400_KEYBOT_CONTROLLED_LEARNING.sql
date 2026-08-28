-- KeySuite V4.14.00 - Controlled KeyBot Learning
-- Language/alias memory only. Commercial, permission and engineering rules remain code/database controlled.

begin;

create table if not exists public.ks_keybot_learning_v41400 (
  id uuid primary key default gen_random_uuid(),
  company_id text not null,
  context text not null default 'global' check (context in ('global','keyplc','pump','tank','customer')),
  phrase text not null,
  meaning text not null,
  learning_type text not null default 'alias' check (learning_type in ('alias','customer_alias','model_alias','term_alias')),
  confidence numeric(4,3) not null default 1.000 check (confidence >= 0 and confidence <= 1),
  status text not null default 'approved' check (status in ('suggested','approved','disabled')),
  source text not null default 'telegram_owner',
  created_by_email text,
  approved_by_email text,
  usage_count bigint not null default 0,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ks_keybot_learning_v41400_company_context_idx
  on public.ks_keybot_learning_v41400 (company_id, context, status);

create unique index if not exists ks_keybot_learning_v41400_active_phrase_uq
  on public.ks_keybot_learning_v41400 (company_id, context, lower(phrase))
  where status = 'approved';

alter table public.ks_keybot_learning_v41400 enable row level security;

revoke all on table public.ks_keybot_learning_v41400 from anon;
grant select, insert, update on table public.ks_keybot_learning_v41400 to authenticated;

-- Owner/Admin may inspect/manage learning from future KeySuite UI. The Edge Function uses service role.
drop policy if exists ks_keybot_learning_v41400_owner_admin_select on public.ks_keybot_learning_v41400;
create policy ks_keybot_learning_v41400_owner_admin_select
on public.ks_keybot_learning_v41400 for select
to authenticated
using (
  exists (
    select 1 from public.ks_user_access ua
    where ua.company_id = ks_keybot_learning_v41400.company_id
      and lower(ua.email) = lower(coalesce(auth.jwt()->>'email',''))
      and ua.active = true
      and lower(ua.role) in ('owner','admin')
  )
);

drop policy if exists ks_keybot_learning_v41400_owner_admin_insert on public.ks_keybot_learning_v41400;
create policy ks_keybot_learning_v41400_owner_admin_insert
on public.ks_keybot_learning_v41400 for insert
to authenticated
with check (
  exists (
    select 1 from public.ks_user_access ua
    where ua.company_id = ks_keybot_learning_v41400.company_id
      and lower(ua.email) = lower(coalesce(auth.jwt()->>'email',''))
      and ua.active = true
      and lower(ua.role) in ('owner','admin')
  )
);

drop policy if exists ks_keybot_learning_v41400_owner_admin_update on public.ks_keybot_learning_v41400;
create policy ks_keybot_learning_v41400_owner_admin_update
on public.ks_keybot_learning_v41400 for update
to authenticated
using (
  exists (
    select 1 from public.ks_user_access ua
    where ua.company_id = ks_keybot_learning_v41400.company_id
      and lower(ua.email) = lower(coalesce(auth.jwt()->>'email',''))
      and ua.active = true
      and lower(ua.role) in ('owner','admin')
  )
)
with check (
  exists (
    select 1 from public.ks_user_access ua
    where ua.company_id = ks_keybot_learning_v41400.company_id
      and lower(ua.email) = lower(coalesce(auth.jwt()->>'email',''))
      and ua.active = true
      and lower(ua.role) in ('owner','admin')
  )
);

notify pgrst, 'reload schema';
commit;
