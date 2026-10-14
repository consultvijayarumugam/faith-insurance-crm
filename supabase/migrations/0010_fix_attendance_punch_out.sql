-- ============================================================================
-- Migration 0010: fix attendance_sessions punch-out RLS + harden self-edit
--
-- Bug: 0009's "attendance_sessions_update" policy repeated the same
-- predicate in both USING and WITH CHECK:
--   (agent_id = auth.uid() and punch_out_at is null) or is_admin()
-- USING is evaluated against the OLD row (correctly requires the session to
-- still be open), but WITH CHECK is evaluated against the NEW row — and the
-- whole point of a punch-out is to set punch_out_at to a non-null value, so
-- for a non-admin agent WITH CHECK always evaluated to false and every
-- punch-out was rejected with "new row violates row-level security policy".
--
-- Fix: WITH CHECK only needs to confirm the row still belongs to the same
-- agent (or the caller is an admin) — it must not re-impose the "still
-- open" precondition that only makes sense for the OLD row. The finer
-- invariants (an agent may not edit punch_in_at, may not touch a day other
-- than today, may not reassign the row to someone else) move into a
-- BEFORE UPDATE trigger, since plain RLS predicates can't compare OLD vs
-- NEW column values directly — matching this project's existing pattern in
-- protect_users_privileged_columns() (schema.sql) of enforcing per-column
-- immutability via a trigger rather than RLS alone.
--
-- Run ONCE against the live Faith Insurance CRM database via Supabase SQL
-- Editor > New query. NOT idempotent — do not re-run after a successful
-- COMMIT.
-- ============================================================================

begin;

drop policy "attendance_sessions_update" on public.attendance_sessions;

create policy "attendance_sessions_update" on public.attendance_sessions
for update
using ((agent_id = auth.uid() and punch_out_at is null) or public.is_admin())
with check (agent_id = auth.uid() or public.is_admin());

-- A non-admin caller may only close out (punch out of) their own,
-- still-open, *today's* session, and may not change agent_id, work_date, or
-- punch_in_at while doing so. Admins (is_admin() true, e.g. applying an
-- approved correction) are exempt, same as protect_users_privileged_columns.
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

  return new;
end;
$$;

create trigger trg_attendance_sessions_self_edit_guard
before update on public.attendance_sessions
for each row execute function public.enforce_attendance_session_self_edit();

commit;

-- ============================================================================
-- Post-migration verification (safe, read-only — run after COMMIT):
--
-- select polname, pg_get_expr(polqual, polrelid) as using_expr,
--        pg_get_expr(polwithcheck, polrelid) as check_expr
-- from pg_policy
-- where polrelid = 'public.attendance_sessions'::regclass;
--
-- select tgname from pg_trigger
-- where tgrelid = 'public.attendance_sessions'::regclass and not tgisinternal;
-- ============================================================================
