  -- ============================================================================
  -- Migration 0002: admin-manageable lead statuses, real converted/converted_at
  -- tracking, follow-up/proposal fields on leads, and self-serve profile edits
  -- (name/birthday) on users with a role-escalation guard.
  --
  -- Run ONCE against the live, already-provisioned Faith Insurance CRM database
  -- via Supabase SQL Editor > New query. Paste and run this entire file as a
  -- single execution so the explicit transaction wraps all of it atomically.
  -- NOT idempotent — do not re-run after a successful COMMIT.
  -- ============================================================================

  begin;

  -- ----------------------------------------------------------------------------
  -- 1. lead_statuses: admin-manageable replacement for the lead_status enum
  -- ----------------------------------------------------------------------------

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

  -- Fixed, deterministic seed ids so the leads.status_id backfill below (and
  -- leads.status_id's future DEFAULT) can reference them as plain literals,
  -- with no join / name-matching required.
  insert into public.lead_statuses (id, name, color, sort_order, is_won, is_lost)
  values
    ('00000000-0000-0000-0000-000000000001', 'New',          '#3B82F6', 1, false, false),
    ('00000000-0000-0000-0000-000000000002', 'Contacted',    '#F59E0B', 2, false, false),
    ('00000000-0000-0000-0000-000000000003', 'Quote Shared', '#8B5CF6', 3, false, false),
    ('00000000-0000-0000-0000-000000000004', 'Converted',    '#10B981', 4, true,  false),
    ('00000000-0000-0000-0000-000000000005', 'Lost',         '#EF4444', 5, false, true);

  alter table public.lead_statuses enable row level security;

  -- Any authenticated user can read (needed for status badges/filters/dropdowns
  -- app-wide); only admins can manage the status list itself.
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

  -- ----------------------------------------------------------------------------
  -- 2. leads.status_id: add nullable, backfill by mapping the old enum value,
  --    THEN lock down NOT NULL / DEFAULT. Adding a fixed-literal DEFAULT at
  --    ADD COLUMN time is deliberately avoided here — Postgres does not allow
  --    a subquery in a column DEFAULT, and even a constant default would only
  --    correctly seed *future* inserts, not backfill the mapped value for
  --    existing rows (that's what the explicit UPDATE below does).
  -- ----------------------------------------------------------------------------

  alter table public.leads
    add column status_id uuid references public.lead_statuses (id) on delete restrict;

  -- The CASE's branches are plain string literals, which Postgres resolves to
  -- `text` (not `uuid`) in the absence of any other typed branch — and
  -- text -> uuid is not an implicit assignment cast, only literal-> uuid is.
  -- Casting each branch explicitly avoids relying on that implicit-literal
  -- special case inside a CASE expression.
  update public.leads
  set status_id = case lead_status
    when 'New'          then '00000000-0000-0000-0000-000000000001'::uuid
    when 'Contacted'     then '00000000-0000-0000-0000-000000000002'::uuid
    when 'Quote Shared'  then '00000000-0000-0000-0000-000000000003'::uuid
    when 'Converted'     then '00000000-0000-0000-0000-000000000004'::uuid
    when 'Lost'          then '00000000-0000-0000-0000-000000000005'::uuid
  end;

  -- Defensive sanity check: lead_status was NOT NULL in the old schema and the
  -- CASE above is exhaustive over the enum's only possible values, so this
  -- should never fire — but if it does, abort with a clear diagnostic instead
  -- of failing later with a generic "column contains null values" error.
  do $$
  declare
    v_unmapped integer;
  begin
    select count(*) into v_unmapped from public.leads where status_id is null;
    if v_unmapped > 0 then
      raise exception
        'Migration aborted: % lead(s) failed to map lead_status -> status_id', v_unmapped;
    end if;
  end $$;

  alter table public.leads alter column status_id set not null;
  alter table public.leads alter column status_id set default '00000000-0000-0000-0000-000000000001';

  create index idx_leads_status_id on public.leads (status_id);
  -- idx_leads_status (the old index on lead_status) is dropped automatically
  -- when the lead_status column is dropped in step 6 — no explicit DROP INDEX
  -- needed.

  -- ----------------------------------------------------------------------------
  -- 3. converted: demote from generated column to a real, trigger-maintained
  --    column. DROP EXPRESSION preserves the already-correct data (it was
  --    computed from lead_status up to this instant) with no table rewrite —
  --    no separate backfill UPDATE is needed.
  -- ----------------------------------------------------------------------------

  alter table public.leads alter column converted drop expression;
  alter table public.leads alter column converted set default false;
  alter table public.leads alter column converted set not null;

  -- ----------------------------------------------------------------------------
  -- 4. quote_shared: dropped entirely (confirmed unused beyond type pass-through)
  -- ----------------------------------------------------------------------------

  alter table public.leads drop column quote_shared;

  -- ----------------------------------------------------------------------------
  -- 5. converted_at + new plain columns
  -- ----------------------------------------------------------------------------

  alter table public.leads add column converted_at timestamptz;

  -- DECISION: leave converted_at NULL for leads that were already Converted
  -- before this migration ran — there is no reliable historical "when did
  -- this convert" signal (updated_at reflects ANY edit, not the conversion
  -- event specifically), and guessing would silently corrupt the monthly
  -- "closed cases" report. These pre-existing conversions simply won't appear
  -- in month-filtered reports until the lead is next saved into a won status.
  --
  -- If you'd rather approximate instead of leaving a gap, uncomment:
  -- update public.leads set converted_at = updated_at where converted = true;

  alter table public.leads add column next_follow_up_date date;
  alter table public.leads add column proposal_amount numeric(12, 2);
  alter table public.leads add column proposal_sent_date date;
  alter table public.leads add column proposal_notes text;

  -- Partial index: most leads won't have a follow-up date set, so indexing
  -- only non-null values keeps it small and fast for "due today" dashboards.
  create index idx_leads_next_follow_up_date
    on public.leads (next_follow_up_date)
    where next_follow_up_date is not null;

  -- ----------------------------------------------------------------------------
  -- 6. Drop the old enum column and type (safe now: converted and quote_shared
  --    no longer depend on lead_status, so this needs no CASCADE)
  -- ----------------------------------------------------------------------------

  alter table public.leads drop column lead_status;
  drop type public.lead_status;

  -- ----------------------------------------------------------------------------
  -- 7. converted / converted_at sync trigger
  -- ----------------------------------------------------------------------------

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
      -- UPDATE: only stamp/clear converted_at on an actual won-ness
      -- transition, so moving between two different won statuses (or two
      -- different non-won statuses) never resets the original conversion
      -- timestamp, and resubmitting the same status_id unchanged is a no-op.
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

  -- ----------------------------------------------------------------------------
  -- 8. users.birthday + self-serve name/birthday updates, with a hard guard
  --    against role (and email/id/created_at) escalation via a self-submitted
  --    UPDATE payload. RLS is row-level, not column-level, so USING (id =
  --    auth.uid()) alone would technically permit changing ANY column on your
  --    own row — this trigger is the actual enforcement point.
  -- ----------------------------------------------------------------------------

  alter table public.users add column birthday date;

  create or replace function public.protect_users_privileged_columns()
  returns trigger
  language plpgsql
  as $$
  begin
    if not public.is_admin() then
      -- Non-admins updating their own row may only change name/birthday.
      -- Silently clamp everything else back to its previous value, regardless
      -- of what the client submitted.
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

  -- Existing admin-only policy is kept as-is; this adds a second permissive
  -- policy so a user can update their own row (columns are then restricted by
  -- the trigger above, not by this policy).
  create policy "users_self_update" on public.users
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

  commit;

  -- ============================================================================
  -- Post-migration verification (safe, read-only — run after COMMIT):
  --
  -- select ls.name, count(*) from public.leads l
  -- join public.lead_statuses ls on ls.id = l.status_id
  -- group by ls.name, ls.sort_order order by ls.sort_order;
  --
  -- select count(*) from public.leads l
  -- join public.lead_statuses ls on ls.id = l.status_id
  -- where l.converted <> ls.is_won;  -- expect 0
  --
  -- select count(*) from public.leads where converted = true and converted_at is null;
  -- ============================================================================
