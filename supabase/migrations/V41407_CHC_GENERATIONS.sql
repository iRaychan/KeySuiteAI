-- KeySuite V4.14.07 — CHC Generation Foundation
-- Purpose:
--   1) Classify the entire EXISTING CHC range as Generation G2.
--   2) Preserve every existing CHC product ID, visible model, price and table shape.
--   3) Create a permanent generation namespace so future G1/G3/... data can coexist
--      even when the visible model code is identical.
--   4) Prepare selector settings for multi-generation selection without changing
--      current selector behaviour (G2 only until G1 data is imported).
--
-- IMPORTANT:
-- - This migration intentionally DOES NOT add a column to ks_products_chc.
--   Older KeySuite seed/import SQL uses "insert into ks_products_chc values (...)"
--   without a column list, so changing that table's column count could break reruns.
-- - No quotation PDF/print layout is modified.
-- - No CHC hydraulic curve, technical data, dimension, drawing or price value is modified.
-- - Safe to run more than once.

begin;

do $$
begin
  if to_regclass('public.ks_products_chc') is null then
    raise exception 'KeySuite table public.ks_products_chc was not found. Run the existing KeySuite Supabase foundation first.';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 1. Generation catalogue
-- ---------------------------------------------------------------------------
create table if not exists public.ks_pump_generations_v41407 (
  family_code      text        not null,
  generation_code  text        not null,
  display_name      text        not null,
  sort_order        integer     not null default 0,
  is_active         boolean     not null default true,
  is_current        boolean     not null default false,
  data_ready        boolean     not null default false,
  notes             text        not null default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  primary key (family_code, generation_code),
  constraint ks_pump_generations_v41407_family_ck
    check (family_code ~ '^[A-Z0-9][A-Z0-9_-]*$'),
  constraint ks_pump_generations_v41407_generation_ck
    check (generation_code ~ '^G[1-9][0-9]*$')
);

-- Reserve G1 now, but keep it unavailable until its real data is imported.
insert into public.ks_pump_generations_v41407
  (family_code,generation_code,display_name,sort_order,is_active,is_current,data_ready,notes)
values
  ('CHC','G1','CHC G1',10,false,false,false,
   'Reserved for the older CHC range. Enable only after G1 hydraulic/technical/dimension/drawing/price data is imported.')
on conflict (family_code,generation_code) do nothing;

-- Existing/current CHC becomes G2.
insert into public.ks_pump_generations_v41407
  (family_code,generation_code,display_name,sort_order,is_active,is_current,data_ready,notes)
values
  ('CHC','G2','CHC G2',20,true,true,true,
   'Existing KeySuite CHC range as at V4.14.07. Existing model names, product IDs and all technical resources remain unchanged.')
on conflict (family_code,generation_code) do nothing;

-- G2 is known to contain the current dataset. Do not steal "current" from a
-- future generation if this old migration is ever re-run later.
update public.ks_pump_generations_v41407
set is_active=true,
    data_ready=true,
    updated_at=now()
where family_code='CHC' and generation_code='G2';

update public.ks_pump_generations_v41407 g
set is_current=true,
    updated_at=now()
where g.family_code='CHC'
  and g.generation_code='G2'
  and not exists (
    select 1
    from public.ks_pump_generations_v41407 x
    where x.family_code='CHC'
      and x.generation_code<>'G2'
      and x.is_current=true
  );

create unique index if not exists ks_pump_generations_v41407_one_current_uq
  on public.ks_pump_generations_v41407(family_code)
  where is_current=true;

-- ---------------------------------------------------------------------------
-- 2. Stable model identity registry
--    Same visible model may exist in G1 and G2, but identity_key cannot collide.
-- ---------------------------------------------------------------------------
create table if not exists public.ks_pump_model_registry_v41407 (
  family_code      text        not null,
  generation_code  text        not null,
  model_code        text        not null,
  identity_key      text        not null,
  resource_refs     jsonb       not null default '{}'::jsonb,
  is_active         boolean     not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  primary key (family_code,generation_code,model_code),
  unique (identity_key),
  foreign key (family_code,generation_code)
    references public.ks_pump_generations_v41407(family_code,generation_code)
    on update cascade on delete restrict
);

-- Register every EXISTING CHC visible model under G2.
insert into public.ks_pump_model_registry_v41407
  (family_code,generation_code,model_code,identity_key,resource_refs,is_active)
select distinct
  'CHC',
  'G2',
  trim(p.model),
  'CHC|G2|' || upper(trim(p.model)),
  jsonb_build_object(
    'source','existing-keysuite-chc',
    'technical_namespace','G2',
    'preserve_existing_resources',true
  ),
  true
from public.ks_products_chc p
where coalesce(trim(p.model),'')<>''
on conflict (family_code,generation_code,model_code) do update
set identity_key=excluded.identity_key,
    is_active=true,
    updated_at=now();

-- ---------------------------------------------------------------------------
-- 3. Product -> generation mapping
--    Kept outside ks_products_chc so the legacy table shape never changes.
-- ---------------------------------------------------------------------------
create table if not exists public.ks_chc_product_generation_v41407 (
  product_id       text        primary key,
  generation_code  text        not null,
  assigned_source  text        not null default 'migration',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  foreign key (product_id)
    references public.ks_products_chc(id)
    on update cascade on delete cascade
);

-- Generation is validated by format here and by the CHC catalogue/RPC layer.
-- This deliberately avoids adding a redundant family column to the mapping table.

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname='ks_chc_product_generation_v41407_generation_ck'
      and conrelid='public.ks_chc_product_generation_v41407'::regclass
  ) then
    alter table public.ks_chc_product_generation_v41407
      add constraint ks_chc_product_generation_v41407_generation_ck
      check (generation_code ~ '^G[1-9][0-9]*$');
  end if;
end
$$;

-- Every product that exists before this migration is G2.
insert into public.ks_chc_product_generation_v41407
  (product_id,generation_code,assigned_source)
select p.id,'G2','V4.14.07 existing CHC -> G2'
from public.ks_products_chc p
on conflict (product_id) do nothing;

create index if not exists ks_chc_product_generation_v41407_generation_idx
  on public.ks_chc_product_generation_v41407(generation_code,product_id);

-- ---------------------------------------------------------------------------
-- 4. Backward-compatible automatic mapping for future rows inserted by old code.
--    An unspecified new CHC product inherits the current active CHC generation.
--    Explicit G1 imports can simply UPDATE the mapping to G1 after insert.
-- ---------------------------------------------------------------------------
create or replace function public.keysuite_v41407_map_new_chc_product()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_generation text;
begin
  select generation_code
    into v_generation
  from public.ks_pump_generations_v41407
  where family_code='CHC'
    and is_current=true
    and is_active=true
    and data_ready=true
  order by sort_order desc
  limit 1;

  v_generation := coalesce(nullif(v_generation,''),'G2');

  insert into public.ks_chc_product_generation_v41407
    (product_id,generation_code,assigned_source)
  values
    (new.id,v_generation,'automatic current-generation mapping')
  on conflict (product_id) do nothing;

  insert into public.ks_pump_model_registry_v41407
    (family_code,generation_code,model_code,identity_key,resource_refs,is_active)
  values
    ('CHC',v_generation,trim(new.model),
     'CHC|'||v_generation||'|'||upper(trim(new.model)),
     jsonb_build_object('source','automatic-product-registration'),
     true)
  on conflict (family_code,generation_code,model_code) do nothing;

  return new;
end
$$;

drop trigger if exists keysuite_v41407_map_new_chc_product_trg
  on public.ks_products_chc;

create trigger keysuite_v41407_map_new_chc_product_trg
after insert on public.ks_products_chc
for each row
execute function public.keysuite_v41407_map_new_chc_product();

-- ---------------------------------------------------------------------------
-- 5. Read view used by new Selector / KeyBot / pricing code.
--    Existing code may continue reading ks_products_chc unchanged.
-- ---------------------------------------------------------------------------
create or replace view public.ks_products_chc_generation_v41407 as
select
  p.id,
  p.product_category,
  p.model,
  coalesce(m.generation_code,'G2') as generation_code,
  'CHC|' || coalesce(m.generation_code,'G2') || '|' || upper(trim(p.model)) as identity_key,
  p.chc_usd,
  p.chcs_usd,
  p.chcn_usd,
  p.source_row
from public.ks_products_chc p
left join public.ks_chc_product_generation_v41407 m
  on m.product_id=p.id;

-- ---------------------------------------------------------------------------
-- 6. RPC: generation list for Selector.
--    G1 is hidden now because data_ready=false. It appears automatically once
--    G1 is imported and enabled.
-- ---------------------------------------------------------------------------
create or replace function public.keysuite_v41407_list_pump_generations(p_family text default 'CHC')
returns table(
  family_code text,
  generation_code text,
  display_name text,
  sort_order integer,
  is_current boolean,
  data_ready boolean
)
language sql
stable
security definer
set search_path=public
as $$
  select
    g.family_code,
    g.generation_code,
    g.display_name,
    g.sort_order,
    g.is_current,
    g.data_ready
  from public.ks_pump_generations_v41407 g
  where g.family_code=upper(trim(coalesce(p_family,'')))
    and g.is_active=true
    and g.data_ready=true
  order by g.sort_order,g.generation_code
$$;

-- ---------------------------------------------------------------------------
-- 7. RPC: generation-aware CHC product lookup.
--    p_generations examples:
--      array['G2']       -> G2 only
--      array['G1','G2']  -> both
--      null              -> current generation (G2 today)
-- ---------------------------------------------------------------------------
create or replace function public.keysuite_v41407_chc_products(
  p_generations text[] default null,
  p_model text default null
)
returns table(
  product_id text,
  generation_code text,
  model text,
  identity_key text,
  chc_usd numeric,
  chcs_usd numeric,
  chcn_usd numeric,
  source_row integer
)
language sql
stable
security definer
set search_path=public
as $$
  with wanted as (
    select case
      when p_generations is not null and cardinality(p_generations)>0
        then array(select upper(trim(x)) from unnest(p_generations) x where trim(x)<>'')
      else array(
        select g.generation_code
        from public.ks_pump_generations_v41407 g
        where g.family_code='CHC'
          and g.is_current=true
          and g.is_active=true
          and g.data_ready=true
        order by g.sort_order desc
        limit 1
      )
    end as generations
  )
  select
    p.id as product_id,
    p.generation_code,
    p.model,
    p.identity_key,
    p.chc_usd,
    p.chcs_usd,
    p.chcn_usd,
    p.source_row
  from public.ks_products_chc_generation_v41407 p
  cross join wanted w
  where p.generation_code = any(coalesce(w.generations,array['G2']::text[]))
    and (coalesce(trim(p_model),'')='' or lower(trim(p.model))=lower(trim(p_model)))
  order by p.generation_code,p.model,p.id
$$;

-- ---------------------------------------------------------------------------
-- 8. Existing per-user Selector settings: add a generation filter only when
--    the key does not exist. Preserve every other display setting.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.ks_selector_display_settings') is not null then
    execute $sql$
      update public.ks_selector_display_settings
      set settings=jsonb_set(
            coalesce(settings,'{}'::jsonb),
            '{generation_codes}',
            '["G2"]'::jsonb,
            true
          ),
          updated_at=now()
      where selector_family='CHC'
        and not (coalesce(settings,'{}'::jsonb) ? 'generation_codes')
    $sql$;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 9. Read security for the new reference tables/functions.
-- ---------------------------------------------------------------------------
alter table public.ks_pump_generations_v41407 enable row level security;
alter table public.ks_pump_model_registry_v41407 enable row level security;
alter table public.ks_chc_product_generation_v41407 enable row level security;

drop policy if exists ks_pump_generations_v41407_read on public.ks_pump_generations_v41407;
create policy ks_pump_generations_v41407_read
on public.ks_pump_generations_v41407
for select to authenticated
using (true);

drop policy if exists ks_pump_model_registry_v41407_read on public.ks_pump_model_registry_v41407;
create policy ks_pump_model_registry_v41407_read
on public.ks_pump_model_registry_v41407
for select to authenticated
using (true);

drop policy if exists ks_chc_product_generation_v41407_read on public.ks_chc_product_generation_v41407;
create policy ks_chc_product_generation_v41407_read
on public.ks_chc_product_generation_v41407
for select to authenticated
using (true);

revoke all on public.ks_pump_generations_v41407 from anon,authenticated;
revoke all on public.ks_pump_model_registry_v41407 from anon,authenticated;
revoke all on public.ks_chc_product_generation_v41407 from anon,authenticated;

grant select on public.ks_pump_generations_v41407 to authenticated;
grant select on public.ks_pump_model_registry_v41407 to authenticated;
grant select on public.ks_chc_product_generation_v41407 to authenticated;
grant select on public.ks_products_chc_generation_v41407 to authenticated;

revoke all on function public.keysuite_v41407_list_pump_generations(text) from public,anon;
revoke all on function public.keysuite_v41407_chc_products(text[],text) from public,anon;
grant execute on function public.keysuite_v41407_list_pump_generations(text) to authenticated;
grant execute on function public.keysuite_v41407_chc_products(text[],text) to authenticated;

notify pgrst, 'reload schema';

commit;

-- ---------------------------------------------------------------------------
-- Expected after migration:
--   - Existing ks_products_chc table is structurally unchanged.
--   - Every existing CHC product maps to G2.
--   - G1 exists only as a disabled placeholder.
--   - Selector generation default is ["G2"] where user CHC settings already exist.
--   - Existing selector, pricing, quotation and PDF code continues to work unchanged.
-- ---------------------------------------------------------------------------
