-- ============================================================================
-- Migration 0008: app_settings — a single admin-only key/value table for
-- small app-wide config. Step 5 (performance reports) uses it for the
-- "below-threshold" call-count flag; Step 7 (retention) will reuse it for
-- the retention-years setting and dry-run flag rather than adding another
-- table.
--
-- Run ONCE against the live Faith Insurance CRM database via Supabase SQL
-- Editor > New query. Paste and run this entire file as a single execution
-- so the explicit transaction wraps all of it atomically.
-- NOT idempotent — do not re-run after a successful COMMIT.
-- ============================================================================

begin;

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

-- Admin-only in both directions — this is internal config, not something
-- agents need to read (the threshold flag is computed server-side and
-- handed to the UI already resolved, not looked up client-side).
create policy "app_settings_select" on public.app_settings
for select
using (public.is_admin());

create policy "app_settings_insert" on public.app_settings
for insert
with check (public.is_admin());

create policy "app_settings_update" on public.app_settings
for update
using (public.is_admin())
with check (public.is_admin());

create policy "app_settings_delete" on public.app_settings
for delete
using (public.is_admin());

insert into public.app_settings (key, value) values
  ('performance_threshold', '{"min_calls_per_week": 20}'::jsonb),
  ('retention', '{"years": 3, "dry_run": true}'::jsonb);

commit;

-- ============================================================================
-- Post-migration verification (safe, read-only — run after COMMIT):
--
-- select * from public.app_settings order by key;
-- ============================================================================
