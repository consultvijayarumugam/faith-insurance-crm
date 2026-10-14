-- ============================================================================
-- Migration 0006: follow-up history + calendar. Replaces the previously
-- free-editable leads.next_follow_up_date with a proper history table —
-- every scheduled follow-up is now its own row, and a trigger keeps
-- leads.next_follow_up_date in sync as a read-only, derived "earliest
-- pending follow-up" value, so every existing read of that column (lead
-- tables, filters, the "due today" button) keeps working unchanged.
--
-- Run ONCE against the live Faith Insurance CRM database via Supabase SQL
-- Editor > New query. Paste and run this entire file as a single execution
-- so the explicit transaction wraps all of it atomically.
-- NOT idempotent — do not re-run after a successful COMMIT.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. lead_follow_ups
-- ----------------------------------------------------------------------------

create type public.lead_follow_up_status as enum ('pending', 'done', 'missed');

create table public.lead_follow_ups (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  -- Denormalized from leads.agent_id at creation time, purely so the
  -- calendar can filter "this agent's follow-ups" without joining leads on
  -- every query. It is NOT the RLS boundary (the policies below join back
  -- to leads for that, same as lead_notes/lead_tags) and is intentionally
  -- never updated if the lead is later reassigned — a historical scheduling
  -- record, same spirit as lead_notes.agent_id being the note's author.
  agent_id uuid not null references public.users (id) on delete restrict,
  scheduled_at timestamptz not null,
  status public.lead_follow_up_status not null default 'pending',
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_lead_follow_ups_lead_id on public.lead_follow_ups (lead_id);
create index idx_lead_follow_ups_agent_id on public.lead_follow_ups (agent_id);
create index idx_lead_follow_ups_scheduled_at on public.lead_follow_ups (scheduled_at);

alter table public.lead_follow_ups enable row level security;

create trigger trg_lead_follow_ups_updated_at
before update on public.lead_follow_ups
for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. Keep leads.next_follow_up_date in sync — the earliest still-pending
--    follow-up's date, or null if there isn't one. Runs after every write to
--    lead_follow_ups so the column always reflects current reality without
--    the app ever writing to it directly.
-- ----------------------------------------------------------------------------

create or replace function public.sync_lead_next_follow_up()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead_id uuid := coalesce(new.lead_id, old.lead_id);
  v_old_lead_id uuid := old.lead_id;
begin
  update public.leads
  set next_follow_up_date = (
    select min(scheduled_at)::date
    from public.lead_follow_ups
    where lead_id = v_lead_id and status = 'pending'
  )
  where id = v_lead_id;

  -- lead_id is never actually changed by app code, but handle it defensively
  -- in case it ever is: the row's old parent lead also needs recomputing.
  if TG_OP = 'UPDATE' and v_old_lead_id is distinct from new.lead_id then
    update public.leads
    set next_follow_up_date = (
      select min(scheduled_at)::date
      from public.lead_follow_ups
      where lead_id = v_old_lead_id and status = 'pending'
    )
    where id = v_old_lead_id;
  end if;

  return null;
end;
$$;

create trigger trg_lead_follow_ups_sync_next
after insert or update or delete on public.lead_follow_ups
for each row execute function public.sync_lead_next_follow_up();

-- ----------------------------------------------------------------------------
-- 3. RLS — same ownership rule as lead_notes/lead_tags: visible/writable only
--    if the parent lead is visible to you (an agent reaches their own
--    leads' follow-ups, admins reach every lead's).
-- ----------------------------------------------------------------------------

create policy "lead_follow_ups_select" on public.lead_follow_ups
for select
using (
  exists (
    select 1 from public.leads l
    where l.id = lead_follow_ups.lead_id
      and (l.agent_id = auth.uid() or public.is_admin())
  )
);

create policy "lead_follow_ups_insert" on public.lead_follow_ups
for insert
with check (
  exists (
    select 1 from public.leads l
    where l.id = lead_follow_ups.lead_id
      and (l.agent_id = auth.uid() or public.is_admin())
  )
);

create policy "lead_follow_ups_update" on public.lead_follow_ups
for update
using (
  exists (
    select 1 from public.leads l
    where l.id = lead_follow_ups.lead_id
      and (l.agent_id = auth.uid() or public.is_admin())
  )
)
with check (
  exists (
    select 1 from public.leads l
    where l.id = lead_follow_ups.lead_id
      and (l.agent_id = auth.uid() or public.is_admin())
  )
);

create policy "lead_follow_ups_delete" on public.lead_follow_ups
for delete
using (
  exists (
    select 1 from public.leads l
    where l.id = lead_follow_ups.lead_id
      and (l.agent_id = auth.uid() or public.is_admin())
  )
);

commit;

-- ============================================================================
-- Post-migration verification (safe, read-only — run after COMMIT):
--
-- select * from public.lead_follow_ups order by scheduled_at limit 20;
--
-- -- Pick any lead id from your leads table and confirm the derived column
-- -- reads null until a pending follow-up exists for it:
-- select id, name, next_follow_up_date from public.leads limit 5;
-- ============================================================================
