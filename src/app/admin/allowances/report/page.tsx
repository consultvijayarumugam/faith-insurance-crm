import Link from "next/link";
import { ArrowLeft, Contact, IndianRupee, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { HorizontalBarChart, type BarDatum } from "@/components/charts/horizontal-bar-chart";
import { ExportAllowanceCsvButton } from "@/components/allowance/export-csv-button";
import { buildMonthlyAgentTotals } from "@/lib/actions/allowance-reports";
import { formatCurrency } from "@/lib/format";

const AGENT_BAR_COLOR = "#2563eb";

export default async function AllowanceReportPage() {
  const supabase = await createClient();

  const [{ data: agents }, { data: claims }] = await Promise.all([
    supabase.from("users").select("id, name").eq("role", "agent").order("name"),
    supabase
      .from("allowance_claims")
      .select("agent_id, month, status, total_km, total_claimed_amount, total_approved_amount")
      .neq("status", "draft")
      .order("month", { ascending: false })
      .limit(500),
  ]);

  const rows = buildMonthlyAgentTotals(agents ?? [], claims ?? []);

  const totalClaimed = rows.reduce((sum, r) => sum + r.claimed, 0);
  const totalApproved = rows.reduce((sum, r) => sum + r.approved, 0);
  const totalKm = rows.reduce((sum, r) => sum + r.km, 0);

  const byAgent = new Map<string, { name: string; approved: number }>();
  rows.forEach((r) => {
    const existing = byAgent.get(r.agentId) ?? { name: r.agentName, approved: 0 };
    existing.approved += r.approved;
    byAgent.set(r.agentId, existing);
  });
  const chartData: BarDatum[] = Array.from(byAgent.entries())
    .map(([id, v]) => ({
      key: id,
      label: v.name,
      value: v.approved,
      displayValue: formatCurrency(v.approved),
      color: AGENT_BAR_COLOR,
      detail: "Total approved, all months",
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/allowances" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to claims
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">Allowance Report</h2>
          <ExportAllowanceCsvButton rows={rows} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total KM" value={totalKm.toLocaleString("en-IN")} icon={MapPin} accent="brand" />
        <StatCard label="Total Claimed" value={formatCurrency(totalClaimed)} icon={IndianRupee} accent="accent" />
        <StatCard label="Total Approved" value={formatCurrency(totalApproved)} icon={Contact} accent="emerald" />
      </div>

      <HorizontalBarChart
        title="Total approved by agent"
        description="Across all reviewed months"
        data={chartData}
        valueColumnLabel="Approved"
        emptyMessage="No reviewed claims yet."
      />

      <Card>
        <CardContent className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">Month-on-month</h3>
          {rows.length === 0 ? (
            <p className="text-sm text-slate-500">No claims to report on yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                    <th className="py-2 pr-4">Agent</th>
                    <th className="py-2 pr-4">Month</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">KM</th>
                    <th className="py-2 pr-4">Claimed</th>
                    <th className="py-2 pr-4">Approved</th>
                    <th className="py-2">Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={`${r.agentId}-${r.month}-${i}`} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 pr-4 font-medium text-slate-900">{r.agentName}</td>
                      <td className="py-2 pr-4 text-slate-700">{r.month.slice(0, 7)}</td>
                      <td className="py-2 pr-4 capitalize text-slate-700">{r.status.replace("_", " ")}</td>
                      <td className="py-2 pr-4 tabular-nums text-slate-700">{r.km}</td>
                      <td className="py-2 pr-4 tabular-nums text-slate-700">{formatCurrency(r.claimed)}</td>
                      <td className="py-2 pr-4 tabular-nums text-slate-700">{formatCurrency(r.approved)}</td>
                      <td className="py-2 tabular-nums text-slate-700">{formatCurrency(r.paid)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
