-- ============================================================================
-- Migration 0003: admin-defined custom lead fields (text / number / date /
-- select), with per-lead values. Mirrors the lead_statuses pattern — the
-- field list is admin-managed data, not a schema change, and agents can
-- fill in values on their own leads but never edit the field definitions.
--
-- Run ONCE against the live Faith Insurance CRM database via Supabase SQL
-- Editor > New query. Paste and run this entire file as a single execution
-- so the explicit transaction wraps all of it atomically.
-- NOT idempotent — do not re-run after a successful COMMIT.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. lead_field_definitions — the admin-managed list of custom fields
-- ----------------------------------------------------------------------------

create type public.lead_field_type as enum ('text', 'number', 'date', 'select');

create table public.lead_field_definitions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  field_type public.lead_field_type not null,
  -- Only meaningful (and only ever set) when field_type = 'select': a plain
  -- jsonb array of option label strings, e.g. ["Hot", "Warm", "Cold"].
  options jsonb,
  is_required boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint lead_field_definitions_options_only_for_select
    check (field_type = 'select' or options is null)
);

alter table public.lead_field_definitions enable row level security;

-- Any authenticated user can read (needed to render the field on the lead
-- form, bulk-upload mapping, and filters); only admins define/edit/reorder/
-- delete the fields themselves.
create policy "lead_field_definitions_select" on public.lead_field_definitions
for select
using (auth.uid() is not null);

create policy "lead_field_definitions_insert" on public.lead_field_definitions
for insert
with check (public.is_admin());

create policy "lead_field_definitions_update" on public.lead_field_definitions
for update
using (public.is_admin())
with check (public.is_admin());

create policy "lead_field_definitions_delete" on public.lead_field_definitions
for delete
using (public.is_admin());

-- ----------------------------------------------------------------------------
-- 2. lead_field_values — one row per (lead, field definition). Typed columns
--    (rather than a single jsonb value) keep filtering/sorting plain SQL;
--    only the column matching the definition's field_type is ever populated,
--    enforced app-side (the server action resolves field_type before write).
-- ----------------------------------------------------------------------------

create table public.lead_field_values (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  field_definition_id uuid not null references public.lead_field_definitions (id) on delete cascade,
  value_text text,
  value_number numeric(14, 2),
  value_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lead_id, field_definition_id)
);

create index idx_lead_field_values_lead_id on public.lead_field_values (lead_id);
create index idx_lead_field_values_field_definition_id on public.lead_field_values (field_definition_id);

create trigger trg_lead_field_values_updated_at
before update on public.lead_field_values
for each row execute function public.set_updated_at();

alter table public.lead_field_values enable row level security;

-- Visible/writable only if the parent lead is visible to you — same
-- ownership rule as leads_update: an agent reaches their own leads' values,
-- admins reach every lead's values.
create policy "lead_field_values_select" on public.lead_field_values
for select
using (
  exists (
    select 1 from public.leads l
    where l.id = lead_field_values.lead_id
      and (l.agent_id = auth.uid() or public.is_admin())
  )
);

create policy "lead_field_values_insert" on public.lead_field_values
for insert
with check (
  exists (
    select 1 from public.leads l
    where l.id = lead_field_values.lead_id
      and (l.agent_id = auth.uid() or public.is_admin())
  )
);

create policy "lead_field_values_update" on public.lead_field_values
for update
using (
  exists (
    select 1 from public.leads l
    where l.id = lead_field_values.lead_id
      and (l.agent_id = auth.uid() or public.is_admin())
  )
)
with check (
  exists (
    select 1 from public.leads l
    where l.id = lead_field_values.lead_id
      and (l.agent_id = auth.uid() or public.is_admin())
  )
);

create policy "lead_field_values_delete" on public.lead_field_values
for delete
using (
  exists (
    select 1 from public.leads l
    where l.id = lead_field_values.lead_id
      and (l.agent_id = auth.uid() or public.is_admin())
  )
);

commit;

-- ============================================================================
-- Post-migration verification (safe, read-only — run after COMMIT):
--
-- select * from public.lead_field_definitions order by sort_order;
--
-- select v.*, d.name, d.field_type from public.lead_field_values v
-- join public.lead_field_definitions d on d.id = v.field_definition_id
-- limit 20;
-- ============================================================================
