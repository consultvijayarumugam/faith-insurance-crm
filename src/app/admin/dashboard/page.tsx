import Link from "next/link";
import { Contact, CheckCircle2, Wallet, Users, CalendarClock, PhoneCall, TrendingDown, ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/ui/stat-card";
import { formatCurrency } from "@/lib/format";
import { HorizontalBarChart, type BarDatum } from "@/components/charts/horizontal-bar-chart";
import { GreetingHeader } from "@/components/dashboard/greeting-header";
import { buildAgentPerformanceRows } from "@/lib/actions/reports";
import type { PerformanceThreshold } from "@/types";

// Nominal categories (agent names have no inherent order) → one color for
// every bar, per the dataviz method: never re-encode rank as hue.
const AGENT_BAR_COLOR = "#2563eb";

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const todayStart = `${today}T00:00:00.000Z`;
  const monthStart = `${today.slice(0, 7)}-01`;
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);

  // is_admin() lets this see every agent's leads, not just the caller's own.
  const [
    { data: profile },
    { data: leads },
    { data: agents },
    { data: statuses },
    { count: followUpCount },
    { count: callsToday },
    { count: conversionsThisMonth },
    { count: pendingCorrections },
    { data: weekCallLogs },
    { data: thresholdSetting },
  ] = await Promise.all([
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return { data: null };
      return supabase.from("users").select("name").eq("id", user.id).single();
    }),
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
    supabase.from("call_logs").select("id", { count: "exact", head: true }).gte("started_at", todayStart),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("converted", true)
      .gte("converted_at", monthStart),
    supabase
      .from("attendance_corrections")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase.from("call_logs").select("agent_id, duration_seconds").gte("started_at", weekStart.toISOString()),
    supabase.from("app_settings").select("value").eq("key", "performance_threshold").maybeSingle(),
  ]);

  const weeklyTarget =
    (thresholdSetting?.value as unknown as PerformanceThreshold | undefined)?.min_calls_per_week ?? 0;
  const agentsBelowTarget =
    weeklyTarget > 0
      ? buildAgentPerformanceRows(agents ?? [], weekCallLogs ?? [], weeklyTarget).filter((r) => r.belowThreshold)
          .length
      : 0;

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
      <GreetingHeader name={profile?.name ?? "there"} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-soft">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-50 text-accent-700">
            <PhoneCall className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xs text-slate-400">Team calls today</p>
            <p className="text-sm font-semibold text-slate-900">{callsToday ?? 0}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-soft">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success-50 text-success-700">
            <CheckCircle2 className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xs text-slate-400">Conversions this month</p>
            <p className="text-sm font-semibold text-slate-900">{conversionsThisMonth ?? 0}</p>
          </div>
        </div>
        <Link
          href="/admin/reports/performance"
          className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-soft transition-colors hover:bg-slate-50"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warning-50 text-warning-600">
            <TrendingDown className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xs text-slate-400">Agents below target</p>
            <p className="text-sm font-semibold text-slate-900">{agentsBelowTarget}</p>
          </div>
        </Link>
        <Link
          href="/admin/attendance"
          className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-soft transition-colors hover:bg-slate-50"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger-50 text-danger-600">
            <ClipboardList className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xs text-slate-400">Pending corrections</p>
            <p className="text-sm font-semibold text-slate-900">{pendingCorrections ?? 0}</p>
          </div>
        </Link>
      </div>

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
