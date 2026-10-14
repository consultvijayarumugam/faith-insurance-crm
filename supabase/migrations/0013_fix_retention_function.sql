-- ============================================================================
-- Migration 0013: re-apply run_retention_cleanup() to clear a stale plan.
--
-- Testing 0012 against the live database turned up a reproducible error —
-- any call where at least one lead is eligible for cleanup fails with:
--   42P01: relation "public.lead_tags" does not exist
-- even though public.lead_tags exists and is queryable fine via a plain
-- select (confirmed with the same service-role client, same moment). The
-- function's own earlier statements in the same call (counting
-- lead_notes/call_logs/lead_follow_ups) succeed; only the lead_tags count
-- fails, and it fails 100% of the time, not intermittently.
--
-- This is consistent with Postgres/the connection pooler holding a stale
-- cached execution plan for this function from before lead_tags was in a
-- state it could see — there is nothing wrong with the SQL itself (it's
-- byte-for-byte the same body that was already in 0012). CREATE OR REPLACE
-- FUNCTION forces Postgres to invalidate any cached plans tied to this
-- function across every backend, which is the actual fix; the
-- pg_notify('pgrst','reload schema') at the end is a cheap, harmless nudge
-- in case any of this was also compounded by PostgREST's own schema cache.
--
-- Safe to run standalone and, unlike most migrations here, safe to re-run —
-- CREATE OR REPLACE FUNCTION has no data effect. Still wrapped in
-- begin/commit to match the rest of this project's migrations.
-- ============================================================================

begin;

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

select pg_notify('pgrst', 'reload schema');

commit;

-- ============================================================================
-- Post-migration verification (safe, read-only — run after COMMIT):
--
-- select run_retention_cleanup(1, true, 'manual');
-- -- expect a jsonb object of zero counts (assuming no real leads are
-- -- actually past a 1-year cutoff yet) and NOT a "relation does not exist"
-- -- error, even if some of your real leads make v_lead_count > 0.
-- ============================================================================
