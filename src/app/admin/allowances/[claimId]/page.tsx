import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, AlertTriangle, FileText, Receipt } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { EntryReviewButtons } from "@/components/allowance/entry-review-buttons";
import { MarkPaidForm, ReopenClaimForm } from "@/components/allowance/claim-actions";
import { formatCurrency, formatDate, formatMonthLabel } from "@/lib/format";
import { VEHICLE_TYPE_LABELS } from "@/lib/allowance";
import {
  buildDuplicateKeySet,
  computeAgentAverageKm,
  computeEntryFlags,
} from "@/lib/actions/allowance-reports";
import type { AllowanceEntry, AllowanceSettings } from "@/types";

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  submitted: "bg-warning-50 text-warning-700",
  approved: "bg-success-50 text-success-700",
  partially_approved: "bg-warning-50 text-warning-700",
  rejected: "bg-danger-50 text-danger-700",
  paid: "bg-success-50 text-success-700",
};

export default async function AdminClaimDetailPage(props: { params: Promise<{ claimId: string }> }) {
  const { claimId } = await props.params;
  const supabase = await createClient();

  const { data: claim } = await supabase.from("allowance_claims").select("*").eq("id", claimId).maybeSingle();
  if (!claim) notFound();

  const monthStart = claim.month;
  const [y, m] = monthStart.slice(0, 7).split("-").map(Number);
  const monthEnd = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;

  const [
    { data: agent },
    { data: entriesData },
    { data: attendanceSessions },
    { data: settingRow },
    { data: recentEntries },
  ] = await Promise.all([
    supabase.from("users").select("name").eq("id", claim.agent_id).single(),
    supabase
      .from("allowance_entries")
      .select(
        "*, expenses:allowance_expenses(*), receipts:allowance_receipts(*), leads:allowance_entry_leads(lead:leads(id, name))"
      )
      .eq("claim_id", claimId)
      .order("entry_date", { ascending: true }),
    supabase
      .from("attendance_sessions")
      .select("work_date")
      .eq("agent_id", claim.agent_id)
      .gte("work_date", monthStart)
      .lt("work_date", monthEnd),
    supabase.from("app_settings").select("value").eq("key", "allowance").maybeSingle(),
    // Trailing average uses this agent's approved entries from the last 90
    // days, not just this month, so a single month's figures don't skew it.
    supabase
      .from("allowance_entries")
      .select("km")
      .eq("agent_id", claim.agent_id)
      .eq("status", "approved")
      .gte("entry_date", new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)),
  ]);

  const settings = settingRow?.value as unknown as AllowanceSettings | undefined;
  const dailyKmCap = settings?.daily_km_cap ?? Infinity;
  const receiptRequiredAboveAmount = settings?.receipt_required_above_amount ?? Infinity;

  const entries: AllowanceEntry[] = (entriesData ?? []).map((e) => ({
    ...e,
    leads: ((e.leads ?? []) as unknown as { lead: { id: string; name: string } }[])
      .map((l) => l.lead)
      .filter(Boolean),
  })) as unknown as AllowanceEntry[];

  const punchDays = new Set((attendanceSessions ?? []).map((s) => s.work_date));
  const duplicateKeys = buildDuplicateKeySet(entries);
  const agentAverageKm = computeAgentAverageKm(recentEntries ?? []);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/allowances" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to claims
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">
              {agent?.name ?? "Unknown agent"} — {formatMonthLabel(monthStart.slice(0, 7))}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {claim.total_km} km · {formatCurrency(claim.total_claimed_amount)} claimed ·{" "}
              {formatCurrency(claim.total_approved_amount)} approved
            </p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGE[claim.status]}`}>
            {claim.status.replace("_", " ")}
          </span>
        </div>
      </div>

      {(claim.status === "approved" || claim.status === "partially_approved") && (
        <Card>
          <CardContent>
            <MarkPaidForm claimId={claim.id} />
          </CardContent>
        </Card>
      )}

      {["approved", "partially_approved", "rejected", "paid"].includes(claim.status) && (
        <ReopenClaimForm claimId={claim.id} />
      )}

      {claim.status === "paid" && claim.payment_reference && (
        <p className="text-sm text-slate-500">
          Paid {claim.paid_at ? formatDate(claim.paid_at) : ""} · Ref: {claim.payment_reference}
        </p>
      )}

      {entries.length === 0 && (
        <EmptyState icon={Receipt} title="No entries on this claim" description="There's nothing to review here yet." />
      )}

      <div className="space-y-3">
        {entries.map((entry) => {
          const flags = computeEntryFlags(entry, {
            dailyKmCap,
            receiptRequiredAboveAmount,
            hadPunchInThatDay: punchDays.has(entry.entry_date),
            agentAverageKm,
            duplicateKeys,
          });
          const expensesTotal = (entry.expenses ?? []).reduce((sum, ex) => sum + ex.amount, 0);

          return (
            <Card key={entry.id}>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {formatDate(entry.entry_date)} · {VEHICLE_TYPE_LABELS[entry.vehicle_type]} · {entry.km} km
                    </p>
                    <p className="text-sm text-slate-600">{entry.purpose}</p>
                    {entry.notes && <p className="mt-0.5 text-xs text-slate-400">{entry.notes}</p>}
                    {entry.leads && entry.leads.length > 0 && (
                      <p className="mt-1 text-xs text-slate-400">
                        Leads: {entry.leads.map((l) => l.name).join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[entry.status]}`}>
                      {entry.status}
                    </span>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {formatCurrency(entry.travel_amount + expensesTotal)}
                    </p>
                  </div>
                </div>

                {flags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {flags.map((flag) => (
                      <span
                        key={flag}
                        className="flex items-center gap-1 rounded-full bg-warning-50 px-2 py-0.5 text-xs font-medium text-warning-700"
                      >
                        <AlertTriangle className="h-3 w-3" />
                        {flag}
                      </span>
                    ))}
                  </div>
                )}

                {(entry.expenses ?? []).length > 0 && (
                  <ul className="space-y-0.5 text-sm text-slate-600">
                    {(entry.expenses ?? []).map((ex) => (
                      <li key={ex.id}>
                        {ex.category} — {formatCurrency(ex.amount)}
                        {ex.note && <span className="text-slate-400"> ({ex.note})</span>}
                      </li>
                    ))}
                  </ul>
                )}

                {(entry.receipts ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {(entry.receipts ?? []).map((r) => (
                      <span
                        key={r.id}
                        className="flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600"
                      >
                        <FileText className="h-3 w-3" />
                        {r.file_name}
                      </span>
                    ))}
                  </div>
                )}

                {entry.status === "rejected" && entry.rejection_reason && (
                  <p className="text-sm text-danger-600">Rejected: {entry.rejection_reason}</p>
                )}

                {entry.status === "submitted" && <EntryReviewButtons entryId={entry.id} />}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
