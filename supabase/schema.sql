-- ============================================================================
-- Faith Insurance CRM — schema
-- Run this once in the Supabase SQL Editor (Project > SQL Editor > New query)
-- on a fresh project. Safe to re-run only after a full reset — it does not
-- use `if not exists` guards for types/policies so re-running against an
-- already-provisioned project will error on duplicates.
--
-- If you already ran an earlier version of this file against a live project
-- (lead_status as a fixed enum, no lead_statuses table), do NOT re-run this
-- file — apply supabase/migrations/0002_lead_statuses_and_profile_fields.sql
-- instead, which migrates that project to this same end state in place.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Enums
-- ----------------------------------------------------------------------------

create type public.user_role as enum ('agent', 'admin');

create type public.call_type as enum (
  'Inbound Call',
  'Outbound Call',
  'WhatsApp',
  'Email',
  'Meeting',
  'Other'
);

-- ----------------------------------------------------------------------------
-- 2. Tables
-- ----------------------------------------------------------------------------

-- One row per authenticated user, 1:1 with auth.users. Holds the app-facing
-- profile (name/email/role/birthday) that RLS policies key off of.
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text not null unique,
  role public.user_role not null default 'agent',
  birthday date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Admin-manageable lead pipeline stages. Runtime-editable (add/rename/
-- recolor/reorder/delete) so the sales pipeline isn't hardcoded in the DB
-- schema. is_won / is_lost drive leads.converted and leads.converted_at.
create table public.lead_statuses (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null check (color ~* '^#[0-9a-f]{6}$'),
  sort_order integer not null default 0,
  is_won boolean not null default false,
  is_lost boolean not null default false,
  created_at timestamptz not null default now(),
  constraint lead_statuses_not_won_and_lost check (not (is_won and is_lost))
);

insert into public.lead_statuses (id, name, color, sort_order, is_won, is_lost)
values
  ('00000000-0000-0000-0000-000000000001', 'New',          '#3B82F6', 1, false, false),
  ('00000000-0000-0000-0000-000000000002', 'Contacted',    '#F59E0B', 2, false, false),
  ('00000000-0000-0000-0000-000000000003', 'Quote Shared', '#8B5CF6', 3, false, false),
  ('00000000-0000-0000-0000-000000000004', 'Converted',    '#10B981', 4, true,  false),
  ('00000000-0000-0000-0000-000000000005', 'Lost',         '#EF4444', 5, false, true);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.users (id) on delete restrict,
  name text not null,
  mobile_number text not null,
  email text,
  product_pitched text,
  value numeric(12, 2) not null default 0,
  status_id uuid not null references public.lead_statuses (id) on delete restrict
    default '00000000-0000-0000-0000-000000000001',
  -- Kept in sync by trg_leads_sync_converted (not app-writable in practice):
  -- true iff status_id currently points at an is_won status.
  converted boolean not null default false,
  -- Set to now() the moment converted flips false->true; cleared to null if
  -- later flipped true->false. Drives the monthly "closed cases" report.
  converted_at timestamptz,
  policy_start_date date,
  policy_end_date date,
  next_follow_up_date date,
  proposal_amount numeric(12, 2),
  proposal_sent_date date,
  proposal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete cascade,
  agent_id uuid references public.users (id) on delete set null,
  note_text text not null,
  call_type public.call_type,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 3. Indexes
-- ----------------------------------------------------------------------------

create index idx_leads_agent_id on public.leads (agent_id);
create index idx_leads_status_id on public.leads (status_id);
create index idx_leads_mobile_number on public.leads (mobile_number);
create index idx_leads_created_at on public.leads (created_at desc);
create index idx_leads_next_follow_up_date on public.leads (next_follow_up_date)
  where next_follow_up_date is not null;
create index idx_lead_notes_lead_id on public.lead_notes (lead_id, created_at desc);

-- ----------------------------------------------------------------------------
-- 4. Helper functions & triggers
-- ----------------------------------------------------------------------------

-- SECURITY DEFINER so it can read public.users without re-entering RLS on
-- that same table (which would otherwise recurse). This is the standard
-- Supabase pattern for RLS helper functions.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_users_updated_at
before update on public.users
for each row execute function public.set_updated_at();

create trigger trg_leads_updated_at
before update on public.leads
for each row execute function public.set_updated_at();

-- Auto-provisions a public.users profile whenever a new auth.users row is
-- created (covers both the admin-invite flow and any user created directly
-- in the Supabase dashboard). Reads name/role from user_metadata if present,
-- otherwise defaults to 'agent' with the email's local part as the name.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'agent')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Keeps leads.converted / leads.converted_at in sync with the is_won flag of
-- the lead's current status_id. converted_at is stamped the moment
-- converted flips false->true and cleared if it flips back — moving between
-- two different won statuses (or two different non-won statuses) never
-- resets it, so the monthly "closed cases" report stays accurate even if a
-- status is later renamed/re-split.
create or replace function public.sync_lead_converted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_won boolean;
begin
  select is_won into v_is_won
  from public.lead_statuses
  where id = new.status_id;

  v_is_won := coalesce(v_is_won, false);
  new.converted := v_is_won;

  if TG_OP = 'INSERT' then
    -- OLD is not available on INSERT; a lead created directly into a won
    -- status is converted from the moment it exists.
    new.converted_at := case when v_is_won then now() else null end;
  else
    if v_is_won and not coalesce(old.converted, false) then
      new.converted_at := now();
    elsif not v_is_won and coalesce(old.converted, false) then
      new.converted_at := null;
    else
      new.converted_at := old.converted_at;
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_leads_sync_converted
before insert or update of status_id on public.leads
for each row execute function public.sync_lead_converted();

-- Prevents a non-admin from escalating their own role (or changing
-- email/id/created_at) via a self-submitted UPDATE on public.users. RLS is
-- row-level, not column-level, so a bare "id = auth.uid()" update policy
-- would otherwise permit changing ANY column on your own row — this trigger
-- is the actual enforcement point, leaving only name/birthday genuinely
-- self-editable.
create or replace function public.protect_users_privileged_columns()
returns trigger
language plpgsql
as $$
begin
  if not public.is_admin() then
    new.role := old.role;
    new.email := old.email;
    new.id := old.id;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

create trigger trg_users_protect_privileged_columns
before update on public.users
for each row execute function public.protect_users_privileged_columns();

-- ----------------------------------------------------------------------------
-- 5. Row Level Security
-- ----------------------------------------------------------------------------

alter table public.users enable row level security;
alter table public.lead_statuses enable row level security;
alter table public.leads enable row level security;
alter table public.lead_notes enable row level security;

-- users: everyone can read their own profile; admins can read everyone's
-- (needed for agent-name filters/dropdowns on the admin dashboard, and for
-- the admin-side "whose birthday is today" check).
create policy "users_select" on public.users
for select
using (id = auth.uid() or public.is_admin());

-- users: admins can edit anyone's profile (e.g. changing a role).
create policy "users_update_admin_only" on public.users
for update
using (public.is_admin())
with check (public.is_admin());

-- users: a signed-in user can update their own row — restricted in practice
-- to name/birthday by trg_users_protect_privileged_columns above. There is
-- intentionally no insert policy for authenticated/anon — rows are created
-- only via the handle_new_user trigger (security definer) or the service
-- role key (admin-invite API route), both of which bypass RLS.
create policy "users_self_update" on public.users
for update
using (id = auth.uid())
with check (id = auth.uid());

-- lead_statuses: any authenticated user can read (status badges/filters/
-- dropdowns app-wide); only admins can manage the status list itself.
create policy "lead_statuses_select" on public.lead_statuses
for select
using (auth.uid() is not null);

create policy "lead_statuses_insert" on public.lead_statuses
for insert
with check (public.is_admin());

create policy "lead_statuses_update" on public.lead_statuses
for update
using (public.is_admin())
with check (public.is_admin());

create policy "lead_statuses_delete" on public.lead_statuses
for delete
using (public.is_admin());

-- leads: an agent sees only their own leads; admins see all.
create policy "leads_select" on public.leads
for select
using (agent_id = auth.uid() or public.is_admin());

-- leads: an agent can create leads assigned to themselves; admins can
-- create/import leads assigned to anyone.
create policy "leads_insert" on public.leads
for insert
with check (agent_id = auth.uid() or public.is_admin());

-- leads: an agent can edit their own leads but cannot reassign them
-- (with check still requires agent_id = auth.uid() on the new row).
-- Admins can edit and reassign any lead.
create policy "leads_update" on public.leads
for update
using (agent_id = auth.uid() or public.is_admin())
with check (agent_id = auth.uid() or public.is_admin());

-- leads: only admins can delete.
create policy "leads_delete" on public.leads
for delete
using (public.is_admin());

-- lead_notes: visible only if the parent lead is visible to you.
create policy "lead_notes_select" on public.lead_notes
for select
using (
  exists (
    select 1 from public.leads l
    where l.id = lead_notes.lead_id
      and (l.agent_id = auth.uid() or public.is_admin())
  )
);

-- lead_notes: you can only author a note as yourself, and only on a lead
-- you can see.
create policy "lead_notes_insert" on public.lead_notes
for insert
with check (
  agent_id = auth.uid()
  and exists (
    select 1 from public.leads l
    where l.id = lead_notes.lead_id
      and (l.agent_id = auth.uid() or public.is_admin())
  )
);

-- lead_notes: an agent can edit/delete their own notes; admins can
-- moderate any note.
create policy "lead_notes_update" on public.lead_notes
for update
using (agent_id = auth.uid() or public.is_admin())
with check (agent_id = auth.uid() or public.is_admin());

create policy "lead_notes_delete" on public.lead_notes
for delete
using (agent_id = auth.uid() or public.is_admin());

-- ============================================================================
-- Post-install step (manual, one-time):
--
-- 1. Create your first user normally, either by having them sign in once via
--    the app's login page after you create their auth account in
--    Authentication > Users > Add user in the Supabase dashboard, or by
--    inviting them from there directly.
-- 2. Promote that user to admin:
--
--      update public.users set role = 'admin' where email = 'you@example.com';
--
--    Every subsequent agent can then be created from the in-app "Agents"
--    admin screen, which creates the auth user and profile in one step.
-- ============================================================================
