-- ============================================================================
-- Migration 0009: attendance — one punch-clock session per agent per day,
-- plus an agent-submitted/admin-reviewed correction workflow for fixing a
-- missed or wrong punch after the fact.
--
-- Run ONCE against the live Faith Insurance CRM database via Supabase SQL
-- Editor > New query. Paste and run this entire file as a single execution
-- so the explicit transaction wraps all of it atomically.
-- NOT idempotent — do not re-run after a successful COMMIT.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. attendance_sessions — one row per agent per calendar day (work_date is
--    the agent's local/IST day, computed app-side at punch-in time, not the
--    server's UTC date).
-- ----------------------------------------------------------------------------

create table public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.users (id) on delete restrict,
  work_date date not null,
  punch_in_at timestamptz not null default now(),
  punch_out_at timestamptz,
  created_at timestamptz not null default now(),
  unique (agent_id, work_date)
);

create index idx_attendance_sessions_agent_id on public.attendance_sessions (agent_id);
create index idx_attendance_sessions_work_date on public.attendance_sessions (work_date);

alter table public.attendance_sessions enable row level security;

create policy "attendance_sessions_select" on public.attendance_sessions
for select
using (agent_id = auth.uid() or public.is_admin());

create policy "attendance_sessions_insert" on public.attendance_sessions
for insert
with check (agent_id = auth.uid() or public.is_admin());

-- An agent may only edit their own still-open session (i.e. punch out of
-- it); admins can edit any session at any time, which is how an approved
-- correction gets applied to a day that's already closed out.
create policy "attendance_sessions_update" on public.attendance_sessions
for update
using ((agent_id = auth.uid() and punch_out_at is null) or public.is_admin())
with check ((agent_id = auth.uid() and punch_out_at is null) or public.is_admin());

create policy "attendance_sessions_delete" on public.attendance_sessions
for delete
using (public.is_admin());

-- ----------------------------------------------------------------------------
-- 2. attendance_corrections — agent-submitted request to adjust a day's
--    punch times; admin approves/rejects, and approval writes the requested
--    times onto attendance_sessions (handled in the app, not a trigger,
--    since it needs to upsert a session row that may not exist yet).
-- ----------------------------------------------------------------------------

create type public.attendance_correction_status as enum ('pending', 'approved', 'rejected');

create table public.attendance_corrections (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.users (id) on delete restrict,
  work_date date not null,
  requested_punch_in_at timestamptz,
  requested_punch_out_at timestamptz,
  reason text not null,
  status public.attendance_correction_status not null default 'pending',
  reviewed_by uuid references public.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_attendance_corrections_agent_id on public.attendance_corrections (agent_id);
create index idx_attendance_corrections_status on public.attendance_corrections (status);

alter table public.attendance_corrections enable row level security;

create policy "attendance_corrections_select" on public.attendance_corrections
for select
using (agent_id = auth.uid() or public.is_admin());

create policy "attendance_corrections_insert" on public.attendance_corrections
for insert
with check (agent_id = auth.uid());

-- Only admins decide the outcome of a correction request.
create policy "attendance_corrections_update" on public.attendance_corrections
for update
using (public.is_admin())
with check (public.is_admin());

create policy "attendance_corrections_delete" on public.attendance_corrections
for delete
using (public.is_admin());

commit;

-- ============================================================================
-- Post-migration verification (safe, read-only — run after COMMIT):
--
-- select * from public.attendance_sessions order by work_date desc limit 20;
-- select * from public.attendance_corrections order by created_at desc limit 20;
-- ============================================================================
