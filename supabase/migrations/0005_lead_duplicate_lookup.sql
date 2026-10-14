-- ============================================================================
-- Migration 0005: a narrow, read-only RPC to support duplicate-mobile-number
-- checking when creating a new lead. An agent's own leads_select RLS only
-- lets them see their own rows, so a plain query can't tell them a mobile
-- number already belongs to a lead owned by a different agent. Rather than
-- widening leads_select (which would leak every agent's full pipeline to
-- every other agent) or reaching for the service-role client from
-- non-admin-verified code, this adds one SECURITY DEFINER function that
-- returns only the two fields needed to show "this number already belongs
-- to <lead name>, owned by <agent name>" — nothing else from the row.
--
-- Run ONCE against the live Faith Insurance CRM database via Supabase SQL
-- Editor > New query. Paste and run this entire file as a single execution
-- so the explicit transaction wraps all of it atomically.
-- NOT idempotent — do not re-run after a successful COMMIT.
-- ============================================================================

begin;

create or replace function public.find_lead_by_mobile(p_mobile text)
returns table (lead_name text, owner_name text)
language sql
security definer
set search_path = public
stable
as $$
  select l.name, u.name
  from public.leads l
  join public.users u on u.id = l.agent_id
  where l.mobile_number = p_mobile
  limit 1;
$$;

-- Callable by any signed-in user (agent or admin), not just admins — this is
-- a dedup check needed by every lead-creation path, not an admin-only
-- operation.
revoke all on function public.find_lead_by_mobile(text) from public;
grant execute on function public.find_lead_by_mobile(text) to authenticated;

commit;

-- ============================================================================
-- Post-migration verification (safe, read-only — run after COMMIT):
--
-- select * from public.find_lead_by_mobile('<some existing mobile number>');
-- ============================================================================
