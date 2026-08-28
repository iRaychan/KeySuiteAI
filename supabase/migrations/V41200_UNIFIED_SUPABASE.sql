-- KeySuite V4.12.00 — Unified Supabase
-- Run in the existing KeySuite Supabase project. Safe to run more than once.

begin;

create extension if not exists pgcrypto;

alter table public.ks_app_settings
  add column if not exists keyai_openai_enabled boolean not null default false,
  add column if not exists keyai_openai_model text not null default 'gpt-5-mini',
  add column if not exists keyai_monthly_request_limit integer not null default 500,
  add column if not exists keyai_openai_last_test_at timestamptz,
  add column if not exists keyai_openai_last_test_ok boolean,
  add column if not exists keyai_openai_last_test_model text,
  add column if not exists keyai_openai_last_test_error text,
  add column if not exists keyai_unified_imported_at timestamptz,
  add column if not exists keyai_legacy_source text;

create table if not exists public.ks_keyai_enquiries (
  id text primary key default (gen_random_uuid()::text),
  source text not null default 'telegram',
  external_update_id bigint,
  external_message_id bigint,
  external_chat_id text,
  sender_username text,
  sender_name text,
  raw_message text not null default '',
  status text not null default 'received',
  ai_enabled boolean not null default false,
  ai_model text,
  ai_summary text,
  ai_result jsonb,
  ai_error text,
  clarification_question text,
  clarification_questions jsonb not null default '[]'::jsonb,
  parent_enquiry_id text,
  conversation_id text,
  external_sender_id text,
  keyai_company_id text,
  keyai_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ks_keyai_enquiries_telegram_update_uq
  on public.ks_keyai_enquiries(source,external_update_id)
  where source='telegram' and external_update_id is not null;
create index if not exists ks_keyai_enquiries_chat_idx on public.ks_keyai_enquiries(source,external_chat_id,created_at desc);
create index if not exists ks_keyai_enquiries_parent_idx on public.ks_keyai_enquiries(parent_enquiry_id);
create index if not exists ks_keyai_enquiries_created_idx on public.ks_keyai_enquiries(created_at desc);

create table if not exists public.ks_keyai_usage (
  id text primary key default (gen_random_uuid()::text),
  provider text not null default 'openai',
  model text not null default '',
  purpose text not null default '',
  requested_by text not null default '',
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cached_input_tokens integer not null default 0,
  estimated_cost_usd numeric(16,8),
  created_at timestamptz not null default now()
);
create index if not exists ks_keyai_usage_created_idx on public.ks_keyai_usage(created_at desc);

alter table public.ks_keyai_enquiries enable row level security;
alter table public.ks_keyai_usage enable row level security;
revoke all on table public.ks_keyai_enquiries from anon,authenticated;
revoke all on table public.ks_keyai_usage from anon,authenticated;

-- Sender → Customer stays in KeySuite and is reused unchanged.
-- Recreate only the table foundation if an older migration was never run.
create table if not exists public.ks_keyai_sender_customer_v40903 (
  keysuite_company_id text not null,
  channel text not null default 'telegram',
  sender_id text not null,
  sender_username text not null default '',
  sender_name text not null default '',
  customer_id text null,
  response_mode text not null default 'nothing',
  active boolean not null default true,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  assigned_by_email text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (keysuite_company_id,channel,sender_id)
);

commit;

-- IMPORTANT: V4090301_KEYSUITE_SUPABASE_MIGRATION.sql must also have been run
-- because it contains the secured Sender → Customer RPC functions used by Telegram.
