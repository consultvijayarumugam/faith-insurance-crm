import { Contact, CheckCircle2, Wallet, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/ui/stat-card";
import { formatCurrency } from "@/lib/format";
import { HorizontalBarChart, type BarDatum } from "@/components/charts/horizontal-bar-chart";
import { LEAD_STATUSES, type LeadStatus } from "@/types";

// Ordinal ramp (one hue, monotone lightness), validated with
// `validate_palette.js --ordinal` — light end still clears 2:1 contrast on
// white. Order follows the fixed pipeline sequence, not lead count.
const STATUS_COLORS: Record<LeadStatus, string> = {
  New: "#60a5fa",
  Contacted: "#3b82f6",
  "Quote Shared": "#2563eb",
  Converted: "#1e40af",
  Lost: "#172554",
};

// Nominal categories (agent names have no inherent order) → one color for
// every bar, per the dataviz method: never re-encode rank as hue.
const AGENT_BAR_COLOR = "#2563eb";

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  // is_admin() lets this see every agent's leads, not just the caller's own.
  const [{ data: leads }, { data: agents }] = await Promise.all([
    supabase.from("leads").select("agent_id, lead_status, converted, value"),
    supabase.from("users").select("id, name").eq("role", "agent").order("name"),
  ]);

  const rows = leads ?? [];
  const totalLeads = rows.length;
  const convertedCount = rows.filter((l) => l.converted).length;
  const pipelineValue = rows
    .filter((l) => l.lead_status !== "Converted" && l.lead_status !== "Lost")
    .reduce((sum, l) => sum + Number(l.value ?? 0), 0);

  const agentStats = new Map(
    (agents ?? []).map((a) => [a.id, { name: a.name, total: 0, converted: 0 }])
  );
  rows.forEach((l) => {
    const stat = agentStats.get(l.agent_id);
    if (stat) {
      stat.total += 1;
      if (l.converted) stat.converted += 1;
    }
  });

  const agentChartData: BarDatum[] = Array.from(agentStats.entries())
    .map(([id, s]) => {
      const rate = s.total > 0 ? (s.converted / s.total) * 100 : 0;
      return {
        key: id,
        label: s.name,
        value: rate,
        displayValue: `${Math.round(rate)}%`,
        color: AGENT_BAR_COLOR,
        detail:
          s.total > 0
            ? `${s.converted} of ${s.total} lead${s.total === 1 ? "" : "s"} converted`
            : "No leads assigned yet",
      };
    })
    .sort((a, b) => b.value - a.value);

  const statusCounts = new Map<LeadStatus, number>(
    LEAD_STATUSES.map((s) => [s, 0])
  );
  rows.forEach((l) => {
    statusCounts.set(l.lead_status, (statusCounts.get(l.lead_status) ?? 0) + 1);
  });

  const statusChartData: BarDatum[] = LEAD_STATUSES.map((status) => {
    const count = statusCounts.get(status) ?? 0;
    const pct = totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0;
    return {
      key: status,
      label: status,
      value: count,
      displayValue: count.toString(),
      color: STATUS_COLORS[status],
      detail: `${pct}% of all leads`,
    };
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Leads"
          value={totalLeads.toString()}
          icon={Contact}
          accent="brand"
        />
        <StatCard
          label="Converted"
          value={convertedCount.toString()}
          icon={CheckCircle2}
          accent="emerald"
        />
        <StatCard
          label="Pipeline Value"
          value={formatCurrency(pipelineValue)}
          icon={Wallet}
          accent="accent"
        />
        <StatCard
          label="Active Agents"
          value={(agents ?? []).length.toString()}
          icon={Users}
          accent="brand"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <HorizontalBarChart
          title="Conversion rate by agent"
          description="Converted leads as a share of each agent's total"
          data={agentChartData}
          valueColumnLabel="Conversion rate"
          maxValue={100}
          emptyMessage="No agents yet. Invite one from the Agents tab."
        />
        <HorizontalBarChart
          title="Leads by status"
          description="Where every lead currently sits in the pipeline"
          data={statusChartData}
          valueColumnLabel="Leads"
          emptyMessage="No leads yet."
        />
      </div>
    </div>
  );
}
