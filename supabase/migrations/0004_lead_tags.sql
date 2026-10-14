-- ============================================================================
-- Migration 0004: lead tags. Any signed-in user (agent or admin) can create a
-- tag and apply/remove it on a lead they can see; only admins can delete a
-- tag outright (which removes it everywhere it was applied).
--
-- Run ONCE against the live Faith Insurance CRM database via Supabase SQL
-- Editor > New query. Paste and run this entire file as a single execution
-- so the explicit transaction wraps all of it atomically.
-- NOT idempotent — do not re-run after a successful COMMIT.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. tags — a shared, flat label list. No separate "tag manager" role: any
--    signed-in user can add one, matching how lightweight a label is
--    compared to the admin-curated lead_statuses pipeline.
-- ----------------------------------------------------------------------------

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null check (color ~* '^#[0-9a-f]{6}$'),
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.tags enable row level security;

create policy "tags_select" on public.tags
for select
using (auth.uid() is not null);

create policy "tags_insert" on public.tags
for insert
with check (created_by = auth.uid());

-- Only admins can delete a tag outright (cascades to every lead_tags row
-- that used it). There is no update policy — tags are rename-free by
-- design; delete and recreate if a name needs to change.
create policy "tags_delete" on public.tags
for delete
using (public.is_admin());

-- ----------------------------------------------------------------------------
-- 2. lead_tags — join table, lead <-> tag
-- ----------------------------------------------------------------------------

create table public.lead_tags (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (lead_id, tag_id)
);

create index idx_lead_tags_lead_id on public.lead_tags (lead_id);
create index idx_lead_tags_tag_id on public.lead_tags (tag_id);

alter table public.lead_tags enable row level security;

-- Visible/writable only if the parent lead is visible to you — same
-- ownership rule as leads_update: an agent reaches their own leads' tags,
-- admins reach every lead's tags.
create policy "lead_tags_select" on public.lead_tags
for select
using (
  exists (
    select 1 from public.leads l
    where l.id = lead_tags.lead_id
      and (l.agent_id = auth.uid() or public.is_admin())
  )
);

create policy "lead_tags_insert" on public.lead_tags
for insert
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.leads l
    where l.id = lead_tags.lead_id
      and (l.agent_id = auth.uid() or public.is_admin())
  )
);

create policy "lead_tags_delete" on public.lead_tags
for delete
using (
  exists (
    select 1 from public.leads l
    where l.id = lead_tags.lead_id
      and (l.agent_id = auth.uid() or public.is_admin())
  )
);

commit;

-- ============================================================================
-- Post-migration verification (safe, read-only — run after COMMIT):
--
-- select * from public.tags order by created_at;
--
-- select lt.*, t.name, l.name as lead_name from public.lead_tags lt
-- join public.tags t on t.id = lt.tag_id
-- join public.leads l on l.id = lt.lead_id
-- limit 20;
-- ============================================================================
