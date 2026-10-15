-- ============================================================================
-- Migration 0013: Allowance / Expense Claims.
--
-- New, self-contained feature — touches no existing table's structure.
-- Adds: allowance_rates, allowance_claims, allowance_entries,
-- allowance_entry_leads, allowance_expenses, allowance_receipts,
-- allowance_audit_log, one new private Storage bucket, and one new
-- app_settings row (reuses that table's existing select-all/write-admin
-- policies unchanged).
--
-- State machine summary (see the two trigger functions below for the
-- actual enforcement):
--   Entry status:  draft -> submitted -> approved | rejected
--                  a rejected entry is fixed + resubmitted in one step
--                  (resubmitEntry in app code), going straight back to
--                  submitted — it does not pass through draft again.
--   Claim status:  draft -> submitted -> approved | rejected | partially_approved
--                  -> paid (paid is never auto-derived, only an explicit
--                  admin action sets it). Claim status is auto-derived from
--                  its entries'/expenses' state by recompute_allowance_claim()
--                  every time an entry or expense changes, except while the
--                  claim itself is still 'draft' (pre-submission) or already
--                  'paid' (terminal) — in both cases only the running
--                  totals are kept current, status is left alone.
--
-- Security model (reuses the 0010/0011 "RLS for broad row access + a
-- trigger for the fine-grained per-column transition rules" pattern):
--   - Non-admins may only UPDATE an entry while its OLD status is 'draft'
--     or 'rejected' (RLS USING), and the trigger enforces the NEW row can
--     only move status to 'draft'/'submitted', can't reassign
--     agent_id/claim_id, and can't touch reviewed_by/reviewed_at or set a
--     new (non-null) rejection_reason themselves.
--   - travel_amount is NEVER trusted from the client at all — a separate
--     BEFORE trigger unconditionally recomputes it from the rate in effect
--     on entry_date, for every insert/update, regardless of actor.
--   - Claim status is written in two different situations: (a) an agent's
--     own submitMonth()/resubmitEntry() actions, which only ever need
--     draft->submitted, allowed directly by the claim-level guard trigger;
--     and (b) recompute_allowance_claim() deriving a status after an
--     admin's approve/reject or an agent's resubmit — for case (b) when
--     it's acting on behalf of an agent session, it would otherwise be
--     blocked by that same claim-level guard (RLS itself already permits
--     the write — the claims UPDATE policy is ownership-only, the status
--     gate is the trigger, not RLS), so it flips a transaction-local flag
--     (allowance.system_sync) that the guard explicitly trusts, rather
--     than needing any elevated privilege. This is a new pattern for this
--     codebase (the attendance/retention precedents never needed one
--     trigger to deliberately bypass another); documented inline below.
--
-- Run ONCE against the live Faith Insurance CRM database via Supabase SQL
-- Editor > New query. NOT idempotent — do not re-run after a successful
-- COMMIT.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Enums
-- ----------------------------------------------------------------------------

create type public.allowance_vehicle_type as enum ('bike', 'car', 'other');
create type public.allowance_entry_status as enum ('draft', 'submitted', 'approved', 'rejected');
create type public.allowance_claim_status as enum ('draft', 'submitted', 'approved', 'partially_approved', 'rejected', 'paid');

-- ----------------------------------------------------------------------------
-- 2. allowance_rates — admin-managed, rate in effect on a given date wins.
-- ----------------------------------------------------------------------------

create table public.allowance_rates (
  id uuid primary key default gen_random_uuid(),
  vehicle_type public.allowance_vehicle_type not null,
  rate_per_km numeric(8, 2) not null check (rate_per_km >= 0),
  effective_from date not null,
  created_at timestamptz not null default now(),
  unique (vehicle_type, effective_from)
);

create index idx_allowance_rates_lookup on public.allowance_rates (vehicle_type, effective_from desc);

alter table public.allowance_rates enable row level security;

-- Select-all so an agent's own live preview calc can read current rates —
-- same pattern as lead_statuses/call_dispositions being globally readable.
create policy "allowance_rates_select" on public.allowance_rates
for select
using (auth.uid() is not null);

create policy "allowance_rates_insert" on public.allowance_rates
for insert
with check (public.is_admin());

create policy "allowance_rates_delete" on public.allowance_rates
for delete
using (public.is_admin());

-- No update policy — a past rate is immutable once created (add a new
-- effective-dated row instead), matching the plan's "add-only history".

-- ----------------------------------------------------------------------------
-- 3. allowance_claims — one per agent per IST month, status mostly
--    auto-derived from its entries (see trigger in section 4).
-- ----------------------------------------------------------------------------

create table public.allowance_claims (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.users (id) on delete restrict,
  month date not null check (month = date_trunc('month', month)::date),
  status public.allowance_claim_status not null default 'draft',
  submitted_at timestamptz,
  reviewed_by uuid references public.users (id) on delete set null,
  reviewed_at timestamptz,
  paid_at timestamptz,
  payment_reference text,
  total_km numeric(10, 2) not null default 0,
  total_travel_amount numeric(12, 2) not null default 0,
  total_expenses_amount numeric(12, 2) not null default 0,
  total_claimed_amount numeric(12, 2) not null default 0,
  total_approved_amount numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agent_id, month)
);

create index idx_allowance_claims_status on public.allowance_claims (status);

alter table public.allowance_claims enable row level security;

create policy "allowance_claims_select" on public.allowance_claims
for select
using (agent_id = auth.uid() or public.is_admin());

-- Non-admin insert must be their own row and start as 'draft' — can't
-- insert a claim pre-marked submitted/approved/paid.
create policy "allowance_claims_insert" on public.allowance_claims
for insert
with check ((agent_id = auth.uid() and status = 'draft') or public.is_admin());

create policy "allowance_claims_update" on public.allowance_claims
for update
using (agent_id = auth.uid() or public.is_admin())
with check (agent_id = auth.uid() or public.is_admin());

create policy "allowance_claims_delete" on public.allowance_claims
for delete
using (public.is_admin());

create trigger trg_allowance_claims_updated_at
before update on public.allowance_claims
for each row execute function public.set_updated_at();

-- Non-admin may only ever move status draft -> submitted directly
-- (submitMonth()). Every other status value, including the ones this
-- same agent will indirectly cause via resubmitEntry(), is written by
-- recompute_allowance_claim() below under the system_sync bypass.
create or replace function public.enforce_allowance_claim_self_edit()
returns trigger
language plpgsql
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if current_setting('allowance.system_sync', true) = 'on' then
    return new;
  end if;

  if new.agent_id <> old.agent_id then
    raise exception 'Agents may not reassign a claim.';
  end if;

  if new.status is distinct from old.status
    and not (old.status = 'draft' and new.status = 'submitted')
  then
    raise exception 'Agents may only submit a draft claim; every other status change is admin-only.';
  end if;

  if new.reviewed_by is distinct from old.reviewed_by
    or new.reviewed_at is distinct from old.reviewed_at
    or new.paid_at is distinct from old.paid_at
    or new.payment_reference is distinct from old.payment_reference
  then
    raise exception 'Agents may not set review or payment fields.';
  end if;

  if new.total_km is distinct from old.total_km
    or new.total_travel_amount is distinct from old.total_travel_amount
    or new.total_expenses_amount is distinct from old.total_expenses_amount
    or new.total_claimed_amount is distinct from old.total_claimed_amount
    or new.total_approved_amount is distinct from old.total_approved_amount
  then
    raise exception 'Agents may not edit claim totals directly — they are system-computed.';
  end if;

  return new;
end;
$$;

create trigger trg_allowance_claims_self_edit_guard
before update on public.allowance_claims
for each row execute function public.enforce_allowance_claim_self_edit();

-- ----------------------------------------------------------------------------
-- 4. allowance_entries
-- ----------------------------------------------------------------------------

create table public.allowance_entries (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.allowance_claims (id) on delete cascade,
  agent_id uuid not null references public.users (id) on delete restrict,
  entry_date date not null,
  vehicle_type public.allowance_vehicle_type not null,
  km numeric(8, 2) not null check (km >= 0),
  purpose text not null,
  -- Always overwritten by compute_allowance_entry_amount() below —
  -- whatever a client sends here is ignored.
  travel_amount numeric(12, 2) not null default 0,
  notes text,
  status public.allowance_entry_status not null default 'draft',
  rejection_reason text,
  reviewed_by uuid references public.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agent_id, entry_date)
);

create index idx_allowance_entries_claim_id on public.allowance_entries (claim_id);
create index idx_allowance_entries_status on public.allowance_entries (status);

alter table public.allowance_entries enable row level security;

create policy "allowance_entries_select" on public.allowance_entries
for select
using (agent_id = auth.uid() or public.is_admin());

-- A non-admin can only add a brand-new entry while the parent claim is
-- still 'draft' (pre-submission) — once submitted, the claim locks as a
-- whole, not just its existing entries. Fixing a rejected line goes
-- through resubmitEntry() on an existing row (UPDATE), never a fresh
-- INSERT, so this doesn't need a 'rejected' carve-out the way UPDATE does.
create policy "allowance_entries_insert" on public.allowance_entries
for insert
with check (
  (
    agent_id = auth.uid()
    and status = 'draft'
    and exists (
      select 1 from public.allowance_claims c
      where c.id = allowance_entries.claim_id and c.agent_id = auth.uid() and c.status = 'draft'
    )
  )
  or public.is_admin()
);

-- USING carries the "old row" precondition (same shape as 0010's fixed
-- attendance_sessions_update) — an agent may only target a row that's
-- currently draft or rejected; the trigger below enforces everything
-- about what the new row may look like.
create policy "allowance_entries_update" on public.allowance_entries
for update
using ((agent_id = auth.uid() and status in ('draft', 'rejected')) or public.is_admin())
with check (agent_id = auth.uid() or public.is_admin());

create policy "allowance_entries_delete" on public.allowance_entries
for delete
using ((agent_id = auth.uid() and status = 'draft') or public.is_admin());

create trigger trg_allowance_entries_updated_at
before update on public.allowance_entries
for each row execute function public.set_updated_at();

create or replace function public.enforce_allowance_entry_self_edit()
returns trigger
language plpgsql
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if new.agent_id <> old.agent_id then
    raise exception 'Agents may not reassign an entry.';
  end if;

  if new.claim_id <> old.claim_id then
    raise exception 'Agents may not move an entry to a different claim.';
  end if;

  if new.status not in ('draft', 'submitted') then
    raise exception 'Agents may only set an entry to draft or submitted.';
  end if;

  if new.reviewed_by is distinct from old.reviewed_by
    or new.reviewed_at is distinct from old.reviewed_at
  then
    raise exception 'Agents may not set review fields.';
  end if;

  -- Resubmitting clears the reason (new value null); agents may never set
  -- a new, different, non-null rejection reason themselves.
  if new.rejection_reason is not null
    and new.rejection_reason is distinct from old.rejection_reason
  then
    raise exception 'Agents may not set a rejection reason.';
  end if;

  return new;
end;
$$;

create trigger trg_allowance_entries_self_edit_guard
before update on public.allowance_entries
for each row execute function public.enforce_allowance_entry_self_edit();

-- Server-side-only amount: unconditionally overwrites travel_amount from
-- the rate in effect on entry_date, for every actor, every write. This is
-- the literal "never trusted from the client" requirement enforced at the
-- database layer, not just in the Server Action.
create or replace function public.compute_allowance_entry_amount()
returns trigger
language plpgsql
as $$
declare
  v_rate numeric(8, 2);
begin
  select rate_per_km into v_rate
  from public.allowance_rates
  where vehicle_type = new.vehicle_type and effective_from <= new.entry_date
  order by effective_from desc
  limit 1;

  if v_rate is null then
    raise exception 'No allowance rate configured for % on or before %', new.vehicle_type, new.entry_date;
  end if;

  new.travel_amount := round(new.km * v_rate, 2);
  return new;
end;
$$;

create trigger trg_allowance_entries_compute_amount
before insert or update on public.allowance_entries
for each row execute function public.compute_allowance_entry_amount();

-- Keeps a claim's status + totals in sync with its entries/expenses.
-- Shared by both the entries trigger and the expenses trigger below, since
-- an expense change also has to roll up into the same claim totals. Not
-- SECURITY DEFINER — every realistic caller (the agent resubmitting their
-- own entry, or an admin reviewing anyone's) already has ordinary RLS
-- write access to the claim row it's about to touch, since the claims
-- UPDATE policy is ownership-only with no status gate (the status gate is
-- the trigger below, not RLS). The only thing this function needs to get
-- past is that same claims-table guard trigger, which it does by flipping
-- the transaction-local allowance.system_sync flag the guard explicitly
-- trusts — not by elevating privilege. (New pattern for this codebase —
-- the attendance/retention precedents never needed one trigger to
-- deliberately bypass another's guard.)
create or replace function public.recompute_allowance_claim(p_claim_id uuid)
returns void
language plpgsql
as $$
declare
  v_current_status public.allowance_claim_status;
  v_total_km numeric(10, 2);
  v_total_travel numeric(12, 2);
  v_total_expenses numeric(12, 2);
  v_total_approved numeric(12, 2);
  v_entry_count int;
  v_submitted_count int;
  v_approved_count int;
  v_rejected_count int;
  v_new_status public.allowance_claim_status;
begin
  if p_claim_id is null then
    return;
  end if;

  select status into v_current_status from public.allowance_claims where id = p_claim_id;
  if v_current_status is null then
    return;
  end if;

  select
    coalesce(sum(e.km), 0),
    coalesce(sum(e.travel_amount), 0),
    coalesce(sum(x.expense_total), 0),
    coalesce(sum(e.travel_amount) filter (where e.status = 'approved'), 0)
      + coalesce(sum(x.expense_total) filter (where e.status = 'approved'), 0),
    count(*),
    count(*) filter (where e.status = 'submitted'),
    count(*) filter (where e.status = 'approved'),
    count(*) filter (where e.status = 'rejected')
  into v_total_km, v_total_travel, v_total_expenses, v_total_approved,
       v_entry_count, v_submitted_count, v_approved_count, v_rejected_count
  from public.allowance_entries e
  left join lateral (
    select coalesce(sum(amount), 0) as expense_total
    from public.allowance_expenses
    where entry_id = e.id
  ) x on true
  where e.claim_id = p_claim_id;

  perform set_config('allowance.system_sync', 'on', true);

  if v_current_status in ('draft', 'paid') then
    -- Pre-submission or already paid out — keep totals current, never
    -- touch status from here.
    update public.allowance_claims
    set total_km = v_total_km,
        total_travel_amount = v_total_travel,
        total_expenses_amount = v_total_expenses,
        total_claimed_amount = v_total_travel + v_total_expenses,
        total_approved_amount = v_total_approved
    where id = p_claim_id;
  else
    if v_submitted_count > 0 then
      v_new_status := 'submitted';
    elsif v_entry_count > 0 and v_approved_count = v_entry_count then
      v_new_status := 'approved';
    elsif v_entry_count > 0 and v_rejected_count = v_entry_count then
      v_new_status := 'rejected';
    else
      v_new_status := 'partially_approved';
    end if;

    update public.allowance_claims
    set status = v_new_status,
        total_km = v_total_km,
        total_travel_amount = v_total_travel,
        total_expenses_amount = v_total_expenses,
        total_claimed_amount = v_total_travel + v_total_expenses,
        total_approved_amount = v_total_approved
    where id = p_claim_id;
  end if;

  perform set_config('allowance.system_sync', 'off', true);
end;
$$;

create or replace function public.trg_sync_allowance_claim_from_entries()
returns trigger
language plpgsql
as $$
begin
  perform public.recompute_allowance_claim(coalesce(new.claim_id, old.claim_id));
  return coalesce(new, old);
end;
$$;

create trigger trg_allowance_entries_sync_claim
after insert or update or delete on public.allowance_entries
for each row execute function public.trg_sync_allowance_claim_from_entries();

-- ----------------------------------------------------------------------------
-- 5. allowance_entry_leads — optional "leads visited that day" links.
-- ----------------------------------------------------------------------------

create table public.allowance_entry_leads (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.allowance_entries (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (entry_id, lead_id)
);

create index idx_allowance_entry_leads_entry_id on public.allowance_entry_leads (entry_id);

alter table public.allowance_entry_leads enable row level security;

create policy "allowance_entry_leads_select" on public.allowance_entry_leads
for select
using (
  exists (
    select 1 from public.allowance_entries e
    where e.id = allowance_entry_leads.entry_id and (e.agent_id = auth.uid() or public.is_admin())
  )
);

create policy "allowance_entry_leads_insert" on public.allowance_entry_leads
for insert
with check (
  exists (
    select 1 from public.allowance_entries e
    where e.id = allowance_entry_leads.entry_id
      and e.agent_id = auth.uid()
      and e.status in ('draft', 'rejected')
  )
  and exists (
    select 1 from public.leads l
    where l.id = allowance_entry_leads.lead_id and l.agent_id = auth.uid()
  )
);

create policy "allowance_entry_leads_delete" on public.allowance_entry_leads
for delete
using (
  exists (
    select 1 from public.allowance_entries e
    where e.id = allowance_entry_leads.entry_id
      and ((e.agent_id = auth.uid() and e.status in ('draft', 'rejected')) or public.is_admin())
  )
);

-- ----------------------------------------------------------------------------
-- 6. allowance_expenses
-- ----------------------------------------------------------------------------

create table public.allowance_expenses (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.allowance_entries (id) on delete cascade,
  category text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  note text,
  created_at timestamptz not null default now()
);

create index idx_allowance_expenses_entry_id on public.allowance_expenses (entry_id);

alter table public.allowance_expenses enable row level security;

create policy "allowance_expenses_select" on public.allowance_expenses
for select
using (
  exists (
    select 1 from public.allowance_entries e
    where e.id = allowance_expenses.entry_id and (e.agent_id = auth.uid() or public.is_admin())
  )
);

create policy "allowance_expenses_insert" on public.allowance_expenses
for insert
with check (
  exists (
    select 1 from public.allowance_entries e
    where e.id = allowance_expenses.entry_id
      and ((e.agent_id = auth.uid() and e.status in ('draft', 'rejected')) or public.is_admin())
  )
);

create policy "allowance_expenses_update" on public.allowance_expenses
for update
using (
  exists (
    select 1 from public.allowance_entries e
    where e.id = allowance_expenses.entry_id
      and ((e.agent_id = auth.uid() and e.status in ('draft', 'rejected')) or public.is_admin())
  )
);

create policy "allowance_expenses_delete" on public.allowance_expenses
for delete
using (
  exists (
    select 1 from public.allowance_entries e
    where e.id = allowance_expenses.entry_id
      and ((e.agent_id = auth.uid() and e.status in ('draft', 'rejected')) or public.is_admin())
  )
);

-- Expense edits roll up into the same claim totals (travel + expenses),
-- via the shared recompute_allowance_claim() helper above — deliberately
-- NOT implemented by touching allowance_entries to re-fire its own
-- triggers, since that would needlessly re-run the entries self-edit
-- guard and could wrongly reject a no-op touch on a rejected entry.
create or replace function public.trg_sync_allowance_claim_from_expenses()
returns trigger
language plpgsql
as $$
declare
  v_entry_id uuid := coalesce(new.entry_id, old.entry_id);
  v_claim_id uuid;
begin
  select claim_id into v_claim_id from public.allowance_entries where id = v_entry_id;
  perform public.recompute_allowance_claim(v_claim_id);
  return coalesce(new, old);
end;
$$;

create trigger trg_allowance_expenses_sync_claim
after insert or update or delete on public.allowance_expenses
for each row execute function public.trg_sync_allowance_claim_from_expenses();

-- ----------------------------------------------------------------------------
-- 7. allowance_receipts (metadata row — see section 9 for the Storage
--    bucket + storage.objects policies the actual files live under).
-- ----------------------------------------------------------------------------

create table public.allowance_receipts (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.allowance_entries (id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  content_type text not null,
  size_bytes integer not null check (size_bytes > 0),
  uploaded_by uuid not null references public.users (id) on delete restrict,
  created_at timestamptz not null default now()
);

create index idx_allowance_receipts_entry_id on public.allowance_receipts (entry_id);

alter table public.allowance_receipts enable row level security;

create policy "allowance_receipts_select" on public.allowance_receipts
for select
using (
  exists (
    select 1 from public.allowance_entries e
    where e.id = allowance_receipts.entry_id and (e.agent_id = auth.uid() or public.is_admin())
  )
);

create policy "allowance_receipts_insert" on public.allowance_receipts
for insert
with check (
  exists (
    select 1 from public.allowance_entries e
    where e.id = allowance_receipts.entry_id
      and ((e.agent_id = auth.uid() and e.status in ('draft', 'rejected')) or public.is_admin())
  )
);

create policy "allowance_receipts_delete" on public.allowance_receipts
for delete
using (
  exists (
    select 1 from public.allowance_entries e
    where e.id = allowance_receipts.entry_id
      and ((e.agent_id = auth.uid() and e.status in ('draft', 'rejected')) or public.is_admin())
  )
);

-- ----------------------------------------------------------------------------
-- 8. allowance_audit_log — append-only (no update/delete policy at all, so
--    RLS denies both to every role, including admins, by default).
-- ----------------------------------------------------------------------------

create table public.allowance_audit_log (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('entry', 'claim')),
  entity_id uuid not null,
  agent_id uuid not null references public.users (id) on delete restrict,
  action text not null,
  actor_id uuid not null references public.users (id) on delete restrict,
  from_status text,
  to_status text,
  reason text,
  created_at timestamptz not null default now()
);

create index idx_allowance_audit_log_entity on public.allowance_audit_log (entity_type, entity_id);
create index idx_allowance_audit_log_agent_id on public.allowance_audit_log (agent_id);

alter table public.allowance_audit_log enable row level security;

create policy "allowance_audit_log_select" on public.allowance_audit_log
for select
using (agent_id = auth.uid() or public.is_admin());

create policy "allowance_audit_log_insert" on public.allowance_audit_log
for insert
with check (agent_id = auth.uid() or public.is_admin());

-- ----------------------------------------------------------------------------
-- 9. Storage — private bucket for receipts. First use of Supabase Storage
--    in this app. Path convention: {agent_id}/{entry_id}/{filename}.
-- ----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'allowance-receipts',
  'allowance-receipts',
  false,
  10485760, -- 10MB
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

create policy "allowance_receipts_storage_select" on storage.objects
for select
using (
  bucket_id = 'allowance-receipts'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
);

create policy "allowance_receipts_storage_insert" on storage.objects
for insert
with check (
  bucket_id = 'allowance-receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "allowance_receipts_storage_delete" on storage.objects
for delete
using (
  bucket_id = 'allowance-receipts'
  and (
    public.is_admin()
    or (
      (storage.foldername(name))[1] = auth.uid()::text
      and exists (
        select 1 from public.allowance_receipts r
        join public.allowance_entries e on e.id = r.entry_id
        where r.storage_path = storage.objects.name
          and e.agent_id = auth.uid()
          and e.status in ('draft', 'rejected')
      )
    )
  )
);

-- ----------------------------------------------------------------------------
-- 10. app_settings — one new row, reuses the table's existing select-all/
--     write-admin-only policies unchanged.
-- ----------------------------------------------------------------------------

insert into public.app_settings (key, value) values
  ('allowance', '{
    "daily_km_cap": 150,
    "monthly_amount_cap": 10000,
    "expense_categories": ["Fuel", "Toll", "Parking", "Food", "Lodging", "Other"],
    "receipt_required_above_amount": 500
  }'::jsonb)
on conflict (key) do nothing;

commit;

-- ============================================================================
-- Post-migration verification (safe, read-only — run after COMMIT):
--
-- select * from public.allowance_rates order by vehicle_type, effective_from;
-- select * from public.app_settings where key = 'allowance';
-- select id, name, public, file_size_limit, allowed_mime_types
--   from storage.buckets where id = 'allowance-receipts';
--
-- select polname, cmd, pg_get_expr(polqual, polrelid) as using_expr,
--        pg_get_expr(polwithcheck, polrelid) as check_expr
-- from pg_policy
-- where polrelid in (
--   'public.allowance_rates'::regclass, 'public.allowance_claims'::regclass,
--   'public.allowance_entries'::regclass, 'public.allowance_entry_leads'::regclass,
--   'public.allowance_expenses'::regclass, 'public.allowance_receipts'::regclass,
--   'public.allowance_audit_log'::regclass
-- )
-- order by polrelid, cmd;
--
-- select tgname, tgrelid::regclass from pg_trigger
-- where tgrelid in ('public.allowance_claims'::regclass, 'public.allowance_entries'::regclass,
--                    'public.allowance_expenses'::regclass)
--   and not tgisinternal;
-- ============================================================================
