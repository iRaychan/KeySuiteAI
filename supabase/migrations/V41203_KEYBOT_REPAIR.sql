-- KeySuite V4.12.03 — KeyBot unified Supabase repair
-- Run in the ONE KeySuite Supabase project. Safe to run more than once.

begin;

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

notify pgrst,'reload schema';
commit;
