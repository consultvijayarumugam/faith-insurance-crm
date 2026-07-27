-- ============================================================================
-- Faith Insurance CRM — initial schema
-- Run this once in the Supabase SQL Editor (Project > SQL Editor > New query)
-- on a fresh project. Safe to re-run only after a full reset — it does not
-- use `if not exists` guards for types/policies so re-running against an
-- already-provisioned project will error on duplicates.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Enums
-- ----------------------------------------------------------------------------

create type public.user_role as enum ('agent', 'admin');

create type public.lead_status as enum (
  'New',
  'Contacted',
  'Quote Shared',
  'Converted',
  'Lost'
);

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
-- profile (name/email/role) that RLS policies key off of.
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text not null unique,
  role public.user_role not null default 'agent',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.users (id) on delete restrict,
  name text not null,
  mobile_number text not null,
  email text,
  product_pitched text,
  value numeric(12, 2) not null default 0,
  lead_status public.lead_status not null default 'New',
  -- Derived, not writable: a lead is only "quote shared" / "converted" once
  -- its status says so. Keeps a single source of truth instead of letting
  -- these drift independently of lead_status.
  quote_shared boolean generated always as (
    lead_status in ('Quote Shared', 'Converted')
  ) stored,
  converted boolean generated always as (
    lead_status = 'Converted'
  ) stored,
  policy_start_date date,
  policy_end_date date,
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
create index idx_leads_status on public.leads (lead_status);
create index idx_leads_mobile_number on public.leads (mobile_number);
create index idx_leads_created_at on public.leads (created_at desc);
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

-- ----------------------------------------------------------------------------
-- 5. Row Level Security
-- ----------------------------------------------------------------------------

alter table public.users enable row level security;
alter table public.leads enable row level security;
alter table public.lead_notes enable row level security;

-- users: everyone can read their own profile; admins can read everyone's
-- (needed for agent-name filters/dropdowns on the admin dashboard).
create policy "users_select" on public.users
for select
using (id = auth.uid() or public.is_admin());

-- users: only admins can edit profiles (e.g. changing a role). There is
-- intentionally no insert policy for authenticated/anon — rows are created
-- only via the handle_new_user trigger (security definer) or the service
-- role key (admin-invite API route), both of which bypass RLS.
create policy "users_update_admin_only" on public.users
for update
using (public.is_admin())
with check (public.is_admin());

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
