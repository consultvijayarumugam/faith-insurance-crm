-- ============================================================================
-- Migration 0011: location capture on attendance punches
--
-- Adds per-punch latitude/longitude/accuracy + a status (captured/denied/
-- unavailable) for both punch-in and punch-out, an admin-configurable
-- "require location to punch" app_settings flag, and loosens app_settings
-- SELECT to any signed-in user (previously admin-only) so the agent's own
-- punch Server Action can read that flag under the agent's own RLS session —
-- matching the existing "select-all, write-admin-only" pattern already used
-- for lead_statuses/call_dispositions, rather than reaching for the
-- service-role client from a non-admin action. app_settings holds nothing
-- sensitive, so this is safe to read org-wide.
--
-- Also extends 0010's enforce_attendance_session_self_edit() trigger so a
-- non-admin can't rewrite their own already-recorded punch-in location
-- after the fact, same rationale as punch_in_at being immutable there.
--
-- Run ONCE against the live Faith Insurance CRM database via Supabase SQL
-- Editor > New query, AFTER 0010 has already been run. NOT idempotent — do
-- not re-run after a successful COMMIT.
-- ============================================================================

begin;

create type public.attendance_location_status as enum ('captured', 'denied', 'unavailable');

alter table public.attendance_sessions
  add column punch_in_latitude double precision,
  add column punch_in_longitude double precision,
  add column punch_in_accuracy_m double precision,
  add column punch_in_location_status public.attendance_location_status,
  add column punch_out_latitude double precision,
  add column punch_out_longitude double precision,
  add column punch_out_accuracy_m double precision,
  add column punch_out_location_status public.attendance_location_status;

alter table public.attendance_sessions
  add constraint attendance_sessions_punch_in_location_consistent check (
    punch_in_location_status is distinct from 'captured'
    or (punch_in_latitude is not null and punch_in_longitude is not null)
  ),
  add constraint attendance_sessions_punch_out_location_consistent check (
    punch_out_location_status is distinct from 'captured'
    or (punch_out_latitude is not null and punch_out_longitude is not null)
  );

create or replace function public.enforce_attendance_session_self_edit()
returns trigger
language plpgsql
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if old.punch_out_at is not null then
    raise exception 'This attendance session is already closed.';
  end if;

  if old.work_date <> (now() at time zone 'Asia/Kolkata')::date then
    raise exception 'Agents may only update today''s attendance session.';
  end if;

  if new.agent_id <> old.agent_id then
    raise exception 'Agents may not reassign an attendance session.';
  end if;

  if new.work_date <> old.work_date then
    raise exception 'Agents may not change the date of an attendance session.';
  end if;

  if new.punch_in_at <> old.punch_in_at then
    raise exception 'Agents may not edit their punch-in time.';
  end if;

  if new.punch_in_latitude is distinct from old.punch_in_latitude
    or new.punch_in_longitude is distinct from old.punch_in_longitude
    or new.punch_in_accuracy_m is distinct from old.punch_in_accuracy_m
    or new.punch_in_location_status is distinct from old.punch_in_location_status
  then
    raise exception 'Agents may not edit their punch-in location.';
  end if;

  return new;
end;
$$;

-- app_settings: let any signed-in user read (agents need require_location_for_punch
-- from their own session); writes stay admin-only (unchanged policies below).
drop policy "app_settings_select" on public.app_settings;

create policy "app_settings_select" on public.app_settings
for select
using (auth.uid() is not null);

insert into public.app_settings (key, value) values
  ('attendance_location', '{"require_location_for_punch": false}'::jsonb)
on conflict (key) do nothing;

commit;

-- ============================================================================
-- Post-migration verification (safe, read-only — run after COMMIT):
--
-- select column_name, data_type from information_schema.columns
-- where table_schema = 'public' and table_name = 'attendance_sessions'
-- order by ordinal_position;
--
-- select * from public.app_settings where key = 'attendance_location';
-- ============================================================================
