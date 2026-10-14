-- ============================================================================
-- Migration 0012: data retention — retention_log table + the
-- run_retention_cleanup() batch sweep function.
--
-- What gets deleted, directly vs. by cascade (so there's no ambiguity):
--   DELETE FROM directly: leads, attendance_sessions, attendance_corrections.
--   Cleaned up as a side effect of deleting a lead, via FKs that already
--   exist (schema.sql, 0003, 0004, 0006, 0007) with on delete cascade to
--   leads.id: lead_notes, lead_field_values, lead_tags, lead_follow_ups,
--   call_logs. Nothing references attendance_sessions.id or
--   attendance_corrections.id, so deleting those directly can't orphan
--   anything either. No new FKs are added by this migration.
--
-- Eligibility (all must hold):
--   Leads  — status is_won or is_lost; next_follow_up_date is null (no
--            pending follow-up); and the greatest of updated_at,
--            converted_at, latest lead_notes/call_logs/lead_follow_ups
--            activity is older than the cutoff.
--   Attendance sessions — work_date older than the cutoff, and no pending
--            correction exists for that agent/work_date (an open review
--            never loses its underlying session data).
--   Attendance corrections — work_date older than the cutoff and status is
--            no longer 'pending' (an unresolved request is never swept).
--
-- Security: run_retention_cleanup() EXECUTE is revoked from anon and
-- authenticated and granted only to service_role below — it can only ever
-- be invoked by a service-role client. The cron route and the "Run now"
-- button's server action both use createAdminClient() for this specific
-- call (after re-deriving the caller is an admin themselves, same as every
-- other admin-only action in this app). As a second, independent guard —
-- not just that grant — the function itself refuses p_dry_run = false
-- unless auth.role() = 'service_role', so a live delete cannot happen
-- except through the cron route, regardless of who calls it or how.
--
-- retention_log stores counts only (jsonb of table -> row count) — never
-- lead names, mobile numbers, or any other row content.
--
-- Run ONCE against the live Faith Insurance CRM database via Supabase SQL
-- Editor > New query. NOT idempotent — do not re-run after a successful
-- COMMIT.
--
-- (If you already ran an earlier version of this file: see 0013, which
-- re-applies run_retention_cleanup() standalone to clear a stale cached
-- plan Postgres had against lead_tags — the function body here was never
-- logically wrong, this file is just kept in sync with 0013 for a fresh
-- install.)
-- ============================================================================

begin;

create table public.retention_log (
  id uuid primary key default gen_random_uuid(),
  run_at timestamptz not null default now(),
  mode text not null check (mode in ('dry_run', 'live')),
  triggered_by text not null check (triggered_by in ('cron', 'manual')),
  counts jsonb not null,
  created_at timestamptz not null default now()
);

create index idx_retention_log_run_at on public.retention_log (run_at desc);

alter table public.retention_log enable row level security;

create policy "retention_log_select" on public.retention_log
for select
using (public.is_admin());

-- Never actually exercised by a normal session (only the service-role
-- client inserts, via the function below, which bypasses RLS) — kept for
-- the same reason every other table here states its policies explicitly.
create policy "retention_log_insert" on public.retention_log
for insert
with check (public.is_admin());

create or replace function public.run_retention_cleanup(
  p_years integer,
  p_dry_run boolean,
  p_triggered_by text default 'manual',
  p_batch_size integer default 200
)
returns jsonb
language plpgsql
as $$
declare
  v_cutoff timestamptz := now() - (p_years || ' years')::interval;
  v_work_date_cutoff date := (current_date - (p_years || ' years')::interval)::date;
  v_lead_ids uuid[];
  v_lead_count int := 0;
  v_note_count int := 0;
  v_call_log_count int := 0;
  v_follow_up_count int := 0;
  v_tag_count int := 0;
  v_field_value_count int := 0;
  v_session_ids uuid[];
  v_session_count int := 0;
  v_correction_ids uuid[];
  v_correction_count int := 0;
  v_result jsonb;
begin
  if p_years not in (1, 2, 3) then
    raise exception 'p_years must be 1, 2, or 3';
  end if;

  if not p_dry_run and auth.role() <> 'service_role' then
    raise exception 'Live retention cleanup may only be run by the service-role cron route.';
  end if;

  -- Closed/lost leads, no pending follow-up, all activity older than cutoff.
  select array_agg(x.id) into v_lead_ids
  from (
    select l.id
    from public.leads l
    join public.lead_statuses s on s.id = l.status_id
    where (s.is_won or s.is_lost)
      and l.next_follow_up_date is null
      and greatest(
            l.updated_at,
            coalesce(l.converted_at, '-infinity'::timestamptz),
            coalesce((select max(n.created_at) from public.lead_notes n where n.lead_id = l.id), '-infinity'::timestamptz),
            coalesce((select max(c.started_at) from public.call_logs c where c.lead_id = l.id), '-infinity'::timestamptz),
            coalesce((select max(f.created_at) from public.lead_follow_ups f where f.lead_id = l.id), '-infinity'::timestamptz)
          ) < v_cutoff
    order by l.updated_at
    limit p_batch_size
  ) x;

  v_lead_count := coalesce(array_length(v_lead_ids, 1), 0);

  if v_lead_count > 0 then
    select count(*) into v_note_count from public.lead_notes where lead_id = any(v_lead_ids);
    select count(*) into v_call_log_count from public.call_logs where lead_id = any(v_lead_ids);
    select count(*) into v_follow_up_count from public.lead_follow_ups where lead_id = any(v_lead_ids);
    select count(*) into v_tag_count from public.lead_tags where lead_id = any(v_lead_ids);
    select count(*) into v_field_value_count from public.lead_field_values where lead_id = any(v_lead_ids);

    if not p_dry_run then
      delete from public.leads where id = any(v_lead_ids);
    end if;
  end if;

  -- Attendance sessions past the cutoff, skipping any day with a still-
  -- pending correction request on file.
  select array_agg(x.id) into v_session_ids
  from (
    select s.id
    from public.attendance_sessions s
    where s.work_date < v_work_date_cutoff
      and not exists (
        select 1 from public.attendance_corrections cc
        where cc.agent_id = s.agent_id and cc.work_date = s.work_date and cc.status = 'pending'
      )
    order by s.work_date
    limit p_batch_size
  ) x;

  v_session_count := coalesce(array_length(v_session_ids, 1), 0);

  if v_session_count > 0 and not p_dry_run then
    delete from public.attendance_sessions where id = any(v_session_ids);
  end if;

  -- Resolved corrections past the cutoff — a pending one is never swept.
  select array_agg(x.id) into v_correction_ids
  from (
    select id
    from public.attendance_corrections
    where work_date < v_work_date_cutoff and status <> 'pending'
    order by work_date
    limit p_batch_size
  ) x;

  v_correction_count := coalesce(array_length(v_correction_ids, 1), 0);

  if v_correction_count > 0 and not p_dry_run then
    delete from public.attendance_corrections where id = any(v_correction_ids);
  end if;

  v_result := jsonb_build_object(
    'leads', v_lead_count,
    'lead_notes', v_note_count,
    'call_logs', v_call_log_count,
    'lead_follow_ups', v_follow_up_count,
    'lead_tags', v_tag_count,
    'lead_field_values', v_field_value_count,
    'attendance_sessions', v_session_count,
    'attendance_corrections', v_correction_count
  );

  insert into public.retention_log (mode, triggered_by, counts)
  values (case when p_dry_run then 'dry_run' else 'live' end, p_triggered_by, v_result);

  return v_result;
end;
$$;

revoke all on function public.run_retention_cleanup(integer, boolean, text, integer) from public;
revoke all on function public.run_retention_cleanup(integer, boolean, text, integer) from anon;
revoke all on function public.run_retention_cleanup(integer, boolean, text, integer) from authenticated;
grant execute on function public.run_retention_cleanup(integer, boolean, text, integer) to service_role;

select pg_notify('pgrst', 'reload schema');

commit;

-- ============================================================================
-- Post-migration verification (safe, read-only — run after COMMIT):
--
-- select grantee, privilege_type from information_schema.routine_privileges
-- where routine_name = 'run_retention_cleanup';
-- -- expect exactly one row: service_role / EXECUTE
--
-- select * from public.retention_log order by run_at desc limit 10;
-- ============================================================================
