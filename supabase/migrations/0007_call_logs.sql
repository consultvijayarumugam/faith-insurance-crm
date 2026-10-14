-- ============================================================================
-- Migration 0007: call/activity log + admin-editable dispositions. This is
-- separate from the existing free-text lead_notes/call_type (which stays
-- untouched) — a structured record of each call (duration, disposition,
-- timing) that Step 5's performance reports will aggregate. The `source`
-- column exists from day one so a future Android app can write rows here
-- directly without a schema change.
--
-- Run ONCE against the live Faith Insurance CRM database via Supabase SQL
-- Editor > New query. Paste and run this entire file as a single execution
-- so the explicit transaction wraps all of it atomically.
-- NOT idempotent — do not re-run after a successful COMMIT.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. call_dispositions — admin-editable flat list, mirrors lead_statuses
--    minus the pipeline-specific color/is_won/is_lost flags.
-- ----------------------------------------------------------------------------

create table public.call_dispositions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.call_dispositions enable row level security;

create policy "call_dispositions_select" on public.call_dispositions
for select
using (auth.uid() is not null);

create policy "call_dispositions_insert" on public.call_dispositions
for insert
with check (public.is_admin());

create policy "call_dispositions_update" on public.call_dispositions
for update
using (public.is_admin())
with check (public.is_admin());

create policy "call_dispositions_delete" on public.call_dispositions
for delete
using (public.is_admin());

-- Seed the dispositions named in the original spec. Deliberately uses
-- gen_random_uuid() (real v4 ids), not short hand-picked ids like
-- supabase/schema.sql's lead_statuses seed — those turned out to fail zod's
-- strict .uuid() validation (see 0005-era bugfix in lib/validations/lead.ts)
-- and this avoids repeating that mistake for a new table.
insert into public.call_dispositions (name, sort_order) values
  ('Interested', 1),
  ('Callback', 2),
  ('Not Interested', 3),
  ('No Answer', 4),
  ('Wrong Number', 5);

-- ----------------------------------------------------------------------------
-- 2. call_logs
-- ----------------------------------------------------------------------------

create type public.call_log_source as enum ('web', 'mobile');

create table public.call_logs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  -- Denormalized from leads.agent_id at creation time, same reasoning as
  -- lead_follow_ups.agent_id: whose performance this call counts toward,
  -- not the RLS boundary (the policies below join back to leads for that)
  -- and never updated if the lead is later reassigned.
  agent_id uuid not null references public.users (id) on delete restrict,
  disposition_id uuid not null references public.call_dispositions (id) on delete restrict,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  notes text,
  source public.call_log_source not null default 'web',
  started_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index idx_call_logs_lead_id on public.call_logs (lead_id);
create index idx_call_logs_agent_id on public.call_logs (agent_id);
create index idx_call_logs_disposition_id on public.call_logs (disposition_id);
create index idx_call_logs_started_at on public.call_logs (started_at);

alter table public.call_logs enable row level security;

-- Same ownership rule as lead_notes/lead_follow_ups: visible/writable only
-- if the parent lead is visible to you.
create policy "call_logs_select" on public.call_logs
for select
using (
  exists (
    select 1 from public.leads l
    where l.id = call_logs.lead_id
      and (l.agent_id = auth.uid() or public.is_admin())
  )
);

create policy "call_logs_insert" on public.call_logs
for insert
with check (
  exists (
    select 1 from public.leads l
    where l.id = call_logs.lead_id
      and (l.agent_id = auth.uid() or public.is_admin())
  )
);

create policy "call_logs_update" on public.call_logs
for update
using (
  exists (
    select 1 from public.leads l
    where l.id = call_logs.lead_id
      and (l.agent_id = auth.uid() or public.is_admin())
  )
)
with check (
  exists (
    select 1 from public.leads l
    where l.id = call_logs.lead_id
      and (l.agent_id = auth.uid() or public.is_admin())
  )
);

create policy "call_logs_delete" on public.call_logs
for delete
using (
  exists (
    select 1 from public.leads l
    where l.id = call_logs.lead_id
      and (l.agent_id = auth.uid() or public.is_admin())
  )
);

commit;

-- ============================================================================
-- Post-migration verification (safe, read-only — run after COMMIT):
--
-- select * from public.call_dispositions order by sort_order;
-- select * from public.call_logs order by started_at desc limit 20;
-- ============================================================================
