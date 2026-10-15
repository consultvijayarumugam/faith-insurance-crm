import Link from "next/link";
import { ChevronLeft, ChevronRight, Receipt } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ClaimStatusBanner } from "@/components/allowance/claim-status-banner";
import { EntryForm } from "@/components/allowance/entry-form";
import { EntryCard } from "@/components/allowance/entry-card";
import { SubmitMonthButton } from "@/components/allowance/submit-month-button";
import { formatCurrency, formatMonthLabel } from "@/lib/format";
import { getMonthIST, monthParamToDate, nextMonthParam, previousMonthParam } from "@/lib/allowance";
import type {
  AllowanceClaim,
  AllowanceEntry,
  AllowanceRate,
  AllowanceSettings,
} from "@/types";

export default async function AgentAllowancesPage(props: {
  searchParams: Promise<{ month?: string }>;
}) {
  const searchParams = await props.searchParams;
  const month = searchParams.month || getMonthIST();
  const monthDate = monthParamToDate(month);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const agentId = user?.id ?? "";

  const [
    { data: claim },
    { data: entriesData },
    { data: pastClaims },
    { data: rates },
    { data: settingRow },
    { data: agentLeads },
  ] = await Promise.all([
    supabase.from("allowance_claims").select("*").eq("agent_id", agentId).eq("month", monthDate).maybeSingle(),
    supabase
      .from("allowance_entries")
      .select(
        "*, expenses:allowance_expenses(*), receipts:allowance_receipts(*), leads:allowance_entry_leads(lead:leads(id, name))"
      )
      .eq("agent_id", agentId)
      .gte("entry_date", monthDate)
      .lt(
        "entry_date",
        `${monthDate.slice(0, 4)}-${String(Number(monthDate.slice(5, 7)) + 1).padStart(2, "0")}-01`
      )
      .order("entry_date", { ascending: false }),
    supabase
      .from("allowance_claims")
      .select("id, month, status, total_claimed_amount, total_approved_amount")
      .eq("agent_id", agentId)
      .neq("month", monthDate)
      .order("month", { ascending: false })
      .limit(12),
    supabase.from("allowance_rates").select("*"),
    supabase.from("app_settings").select("value").eq("key", "allowance").maybeSingle(),
    supabase.from("leads").select("id, name").eq("agent_id", agentId).order("name"),
  ]);

  const settings = settingRow?.value as unknown as AllowanceSettings | undefined;
  const categories = settings?.expense_categories ?? [];

  const entries: AllowanceEntry[] = (entriesData ?? []).map((e) => ({
    ...e,
    leads: ((e.leads ?? []) as unknown as { lead: { id: string; name: string } }[])
      .map((l) => l.lead)
      .filter(Boolean),
  })) as unknown as AllowanceEntry[];

  const hasDraftEntries = entries.some((e) => e.status === "draft");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">Allowances</h2>
          <p className="mt-1 text-sm text-slate-500">
            Log your daily travel and expenses, then submit the month for review.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/agent/allowances?month=${previousMonthParam(month)}`}>
            <Button type="button" variant="secondary" size="sm">
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
          </Link>
          <span className="text-sm font-medium text-slate-700">{formatMonthLabel(month)}</span>
          <Link href={`/agent/allowances?month=${nextMonthParam(month)}`}>
            <Button type="button" variant="secondary" size="sm">
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      <ClaimStatusBanner claim={claim as AllowanceClaim | null} />

      {(!claim || claim.status === "draft") && (
        <EntryForm mode="add" month={month} rates={(rates ?? []) as AllowanceRate[]} />
      )}

      {entries.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No entries yet this month"
          description="Add your first travel entry above."
        />
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              month={month}
              rates={(rates ?? []) as AllowanceRate[]}
              categories={categories}
              agentLeads={agentLeads ?? []}
            />
          ))}
        </div>
      )}

      {hasDraftEntries && (!claim || claim.status === "draft") && <SubmitMonthButton month={month} />}

      {pastClaims && pastClaims.length > 0 && (
        <Card>
          <CardContent className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">Past months</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                    <th className="py-2 pr-4">Month</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Claimed</th>
                    <th className="py-2">Approved</th>
                  </tr>
                </thead>
                <tbody>
                  {pastClaims.map((c) => (
                    <tr key={c.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 pr-4">
                        <Link
                          href={`/agent/allowances?month=${c.month.slice(0, 7)}`}
                          className="font-medium text-brand-700 hover:text-brand-800"
                        >
                          {formatMonthLabel(c.month.slice(0, 7))}
                        </Link>
                      </td>
                      <td className="py-2 pr-4 capitalize text-slate-700">{c.status.replace("_", " ")}</td>
                      <td className="py-2 pr-4 tabular-nums text-slate-700">
                        {formatCurrency(c.total_claimed_amount)}
                      </td>
                      <td className="py-2 tabular-nums text-slate-700">{formatCurrency(c.total_approved_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
