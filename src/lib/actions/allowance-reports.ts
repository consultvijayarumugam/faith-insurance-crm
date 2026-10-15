// Read-only aggregation/flag helpers for the admin allowance review queue
// and report. Plain functions (no "use server") — only ever called from a
// Server Component after it has already fetched rows with the server
// Supabase client, mirroring lib/actions/reports.ts's
// buildAgentPerformanceRows shape. Flags are computed here at read time
// and never persisted, same philosophy as 0012's retention eligibility.

import type { AllowanceClaim, AllowanceClaimStatus, AllowanceEntry } from "@/types";

export interface EntryFlagContext {
  dailyKmCap: number;
  receiptRequiredAboveAmount: number;
  hadPunchInThatDay: boolean;
  /** This agent's trailing average km across their other recent entries
   * (excluding the one being flagged). 0 if there's no history yet. */
  agentAverageKm: number;
  /** Precomputed via buildDuplicateKeySet — "km|purpose" pairs that recur
   * more than once for this agent this month. */
  duplicateKeys: Set<string>;
}

function duplicateKey(km: number, purpose: string): string {
  return `${km}|${purpose.trim().toLowerCase()}`;
}

export function buildDuplicateKeySet(entries: Pick<AllowanceEntry, "km" | "purpose">[]): Set<string> {
  const counts = new Map<string, number>();
  entries.forEach((e) => {
    const key = duplicateKey(e.km, e.purpose);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return new Set(Array.from(counts.entries()).filter(([, count]) => count > 1).map(([key]) => key));
}

export function computeAgentAverageKm(entries: Pick<AllowanceEntry, "km">[]): number {
  if (entries.length === 0) return 0;
  return entries.reduce((sum, e) => sum + e.km, 0) / entries.length;
}

export function computeEntryFlags(
  entry: Pick<AllowanceEntry, "km" | "purpose" | "expenses" | "receipts">,
  ctx: EntryFlagContext
): string[] {
  const flags: string[] = [];

  if (!ctx.hadPunchInThatDay) flags.push("No punch-in that day");

  if (entry.km > ctx.dailyKmCap) flags.push(`Over daily cap (${ctx.dailyKmCap} km)`);

  if (ctx.duplicateKeys.has(duplicateKey(entry.km, entry.purpose))) {
    flags.push("Looks like a duplicate entry");
  }

  if (ctx.agentAverageKm > 0 && entry.km > ctx.agentAverageKm * 2) {
    flags.push(`Well above this agent's usual ~${Math.round(ctx.agentAverageKm)} km`);
  }

  const expensesTotal = (entry.expenses ?? []).reduce((sum, e) => sum + e.amount, 0);
  const hasReceipts = (entry.receipts?.length ?? 0) > 0;
  if (expensesTotal > ctx.receiptRequiredAboveAmount && !hasReceipts) {
    flags.push("Missing receipt");
  }

  return flags;
}

export interface MonthlyAgentTotalRow {
  agentId: string;
  agentName: string;
  month: string;
  status: AllowanceClaimStatus | "none";
  km: number;
  claimed: number;
  approved: number;
  paid: number;
}

export function buildMonthlyAgentTotals(
  agents: { id: string; name: string }[],
  claims: Pick<
    AllowanceClaim,
    "agent_id" | "month" | "status" | "total_km" | "total_claimed_amount" | "total_approved_amount"
  >[]
): MonthlyAgentTotalRow[] {
  const agentNames = new Map(agents.map((a) => [a.id, a.name]));

  return claims
    .map((c) => ({
      agentId: c.agent_id,
      agentName: agentNames.get(c.agent_id) ?? "Unknown",
      month: c.month,
      status: c.status,
      km: c.total_km,
      claimed: c.total_claimed_amount,
      approved: c.total_approved_amount,
      paid: c.status === "paid" ? c.total_approved_amount : 0,
    }))
    .sort((a, b) => b.month.localeCompare(a.month) || a.agentName.localeCompare(b.agentName));
}
