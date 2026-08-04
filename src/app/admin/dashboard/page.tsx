import Link from "next/link";
import { Contact, CheckCircle2, Wallet, Users, CalendarClock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/ui/stat-card";
import { formatCurrency } from "@/lib/format";
import { HorizontalBarChart, type BarDatum } from "@/components/charts/horizontal-bar-chart";

// Nominal categories (agent names have no inherent order) → one color for
// every bar, per the dataviz method: never re-encode rank as hue.
const AGENT_BAR_COLOR = "#2563eb";

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  // is_admin() lets this see every agent's leads, not just the caller's own.
  const [{ data: leads }, { data: agents }, { data: statuses }, { count: followUpCount }] =
    await Promise.all([
      supabase.from("leads").select("agent_id, status_id, status:lead_statuses(*), converted, value"),
      supabase.from("users").select("id, name").eq("role", "agent").order("name"),
      supabase
        .from("lead_statuses")
        .select("id, name, color, sort_order, is_won, is_lost")
        .order("sort_order"),
      supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("next_follow_up_date", today),
    ]);

  const rows = (leads ?? []) as unknown as {
    agent_id: string;
    status_id: string;
    status: { name: string; is_won: boolean; is_lost: boolean } | null;
    converted: boolean;
    value: number;
  }[];

  const totalLeads = rows.length;
  const convertedCount = rows.filter((l) => l.converted).length;
  const pipelineValue = rows
    .filter((l) => !l.status?.is_won && !l.status?.is_lost)
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

  const statusCounts = new Map<string, number>();
  rows.forEach((l) => {
    statusCounts.set(l.status_id, (statusCounts.get(l.status_id) ?? 0) + 1);
  });

  const statusChartData: BarDatum[] = (statuses ?? []).map((status) => {
    const count = statusCounts.get(status.id) ?? 0;
    const pct = totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0;
    return {
      key: status.id,
      label: status.name,
      value: count,
      displayValue: count.toString(),
      color: status.color,
      detail: `${pct}% of all leads`,
    };
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
        <Link href="/admin/leads?followup=today" className="block">
          <StatCard
            label="Follow-ups Today"
            value={(followUpCount ?? 0).toString()}
            icon={CalendarClock}
            accent="rose"
          />
        </Link>
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
