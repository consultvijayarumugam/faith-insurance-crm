// Seeds a couple of months of plausible allowance-claim demo data for the
// real agents already in your database. Plain Node ESM, uses
// @supabase/supabase-js directly with the service-role key from
// .env.local — no new dependency, matches the project's existing seed-
// script convention.
//
// Run with: node --env-file=.env.local scripts/seed-demo-allowances.mjs
//
// What it does:
//   - Makes sure at least one rate exists per vehicle type (inserts a
//     sensible default if none exist yet — the amount-compute trigger
//     requires a rate to be configured before any entry can be saved).
//   - For up to 3 real agents: ~8 entries in the previous IST month
//     (submitted, so you can review/approve/reject them through the real
//     admin UI), and ~3 draft entries in the current month (still being
//     "written up" by the agent). One entry per agent is deliberately
//     over the daily km cap, to exercise the review-queue flags.
//   - Every seeded row has "[demo]" in its purpose/notes, so it's easy to
//     find and delete later.
//   - Deliberately leaves claims in draft/submitted state rather than
//     faking approved/rejected/paid directly — the entries/claims guard
//     triggers only allow an admin's own session to make those
//     transitions (by design, see 0013's migration comments), so
//     exercising approve/reject/mark-paid/reopen is meant to happen
//     through the real admin UI against this seed data, not faked here.
//
// Not run automatically by anyone other than you, and safe to re-run —
// it skips agents/months that already have a claim.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — run with --env-file=.env.local");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

function getMonthIST(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(date).slice(0, 7);
}

function previousMonth(month) {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

const PURPOSES = [
  "[demo] Client visit — policy renewal",
  "[demo] Prospect meeting",
  "[demo] Document collection",
  "[demo] Claim follow-up visit",
  "[demo] Branch visit",
];
const VEHICLES = ["bike", "car", "other"];
const EXPENSE_CATEGORIES = ["Fuel", "Toll", "Parking"];

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function ensureRates() {
  const { data: existing } = await admin.from("allowance_rates").select("vehicle_type");
  const haveTypes = new Set((existing ?? []).map((r) => r.vehicle_type));
  const defaults = [
    { vehicle_type: "bike", rate_per_km: 3, effective_from: "2024-01-01" },
    { vehicle_type: "car", rate_per_km: 7, effective_from: "2024-01-01" },
    { vehicle_type: "other", rate_per_km: 4, effective_from: "2024-01-01" },
  ];
  const missing = defaults.filter((d) => !haveTypes.has(d.vehicle_type));
  if (missing.length > 0) {
    const { error } = await admin.from("allowance_rates").insert(missing);
    if (error) throw new Error(`seeding default rates: ${error.message}`);
    console.log(`seeded default rates for: ${missing.map((m) => m.vehicle_type).join(", ")}`);
  } else {
    console.log("rates already configured for every vehicle type — leaving as-is");
  }
}

async function getOrCreateClaim(agentId, month) {
  const monthDate = `${month}-01`;
  const { data: existing } = await admin
    .from("allowance_claims")
    .select("id, status")
    .eq("agent_id", agentId)
    .eq("month", monthDate)
    .maybeSingle();
  if (existing) return existing;

  const { data: created, error } = await admin
    .from("allowance_claims")
    .insert({ agent_id: agentId, month: monthDate })
    .select("id, status")
    .single();
  if (error) throw new Error(`creating claim for ${agentId} ${month}: ${error.message}`);
  return created;
}

async function seedMonth(agentId, month, { entryCount, submit, dailyCap }) {
  const claim = await getOrCreateClaim(agentId, month);
  if (claim.status !== "draft") {
    console.log(`  ${month}: claim already ${claim.status} — skipping (re-run-safe)`);
    return;
  }

  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const usedDays = new Set();

  for (let i = 0; i < entryCount; i++) {
    let day;
    do {
      day = 1 + Math.floor(Math.random() * Math.min(daysInMonth, 28));
    } while (usedDays.has(day));
    usedDays.add(day);

    const entryDate = `${month}-${String(day).padStart(2, "0")}`;
    const isOverCap = i === 0; // first entry of the month deliberately flag-worthy
    const km = isOverCap ? dailyCap + 40 : Math.round((10 + Math.random() * 35) * 10) / 10;

    const { data: entry, error } = await admin
      .from("allowance_entries")
      .insert({
        claim_id: claim.id,
        agent_id: agentId,
        entry_date: entryDate,
        vehicle_type: randomFrom(VEHICLES),
        km,
        purpose: randomFrom(PURPOSES),
        notes: isOverCap ? "[demo] unusually long trip — flagged for review" : null,
      })
      .select("id")
      .single();
    if (error) {
      console.log(`  skipped ${entryDate} (${error.message})`);
      continue;
    }

    if (Math.random() < 0.4) {
      await admin.from("allowance_expenses").insert({
        entry_id: entry.id,
        category: randomFrom(EXPENSE_CATEGORIES),
        amount: Math.round((50 + Math.random() * 300) * 100) / 100,
        note: "[demo]",
      });
    }
  }

  if (submit) {
    const { error: entriesError } = await admin
      .from("allowance_entries")
      .update({ status: "submitted" })
      .eq("claim_id", claim.id)
      .eq("status", "draft");
    if (entriesError) throw new Error(`submitting entries for ${agentId} ${month}: ${entriesError.message}`);

    const { error: claimError } = await admin
      .from("allowance_claims")
      .update({ status: "submitted", submitted_at: new Date().toISOString() })
      .eq("id", claim.id);
    if (claimError) throw new Error(`submitting claim for ${agentId} ${month}: ${claimError.message}`);
  }

  console.log(`  ${month}: seeded ${entryCount} entries${submit ? " and submitted the claim" : " (left as draft)"}`);
}

async function main() {
  await ensureRates();

  const { data: settingRow } = await admin.from("app_settings").select("value").eq("key", "allowance").maybeSingle();
  const dailyCap = settingRow?.value?.daily_km_cap ?? 150;

  const { data: agents, error: agentsError } = await admin
    .from("users")
    .select("id, name")
    .eq("role", "agent")
    .order("name")
    .limit(3);
  if (agentsError) throw new Error(`fetching agents: ${agentsError.message}`);
  if (!agents || agents.length === 0) {
    console.log("No agents found — invite at least one agent before seeding allowance demo data.");
    return;
  }

  const currentMonth = getMonthIST();
  const prevMonth = previousMonth(currentMonth);

  for (const agent of agents) {
    console.log(`\n${agent.name} (${agent.id})`);
    await seedMonth(agent.id, prevMonth, { entryCount: 8, submit: true, dailyCap });
    await seedMonth(agent.id, currentMonth, { entryCount: 3, submit: false, dailyCap });
  }

  console.log("\nDone. Review/approve/reject/mark-paid through the real admin UI at /admin/allowances.");
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
