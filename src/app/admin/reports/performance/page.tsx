import { Phone, Clock, Timer, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/ui/stat-card";
import { HorizontalBarChart, type BarDatum } from "@/components/charts/horizontal-bar-chart";
import { VerticalBarChart } from "@/components/charts/vertical-bar-chart";
import { PerformanceReportFilters } from "@/components/reports/performance-report-filters";
import { ThresholdForm } from "@/components/reports/threshold-form";
import { ExportCsvButton } from "@/components/reports/export-csv-button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDurationHuman } from "@/lib/format";
import {
  buildAgentPerformanceRows,
  buildDispositionBreakdown,
  buildTimeOfDayHistogram,
  weeksInRange,
} from "@/lib/actions/reports";
import type { CallDisposition, CallLog, PerformanceThreshold } from "@/types";

// Nominal categories (agent/disposition names have no inherent order) → one
// color for every bar, matching the admin dashboard's dataviz convention.
const BAR_COLOR = "#2563eb";
const BELOW_THRESHOLD_COLOR = "#f43f5e";

function defaultRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 6);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export default async function AdminPerformanceReportPage({
  searchParams,
}: {
  searchParams: { start?: string; end?: string; agent?: string };
}) {
  const { start: defaultStart, end: defaultEnd } = defaultRange();
  const start = searchParams.start || defaultStart;
  const end = searchParams.end || defaultEnd;
  const agentFilter = searchParams.agent || "";

  const rangeStart = `${start}T00:00:00.000Z`;
  const rangeEndExclusive = new Date(`${end}T00:00:00`);
  rangeEndExclusive.setDate(rangeEndExclusive.getDate() + 1);
  const rangeEnd = rangeEndExclusive.toISOString();

  const supabase = await createClient();

  let callLogsQuery = supabase
    .from("call_logs")
    .select("agent_id, disposition_id, duration_seconds, started_at")
    .gte("started_at", rangeStart)
    .lt("started_at", rangeEnd);
  if (agentFilter) callLogsQuery = callLogsQuery.eq("agent_id", agentFilter);

  const [{ data: agents }, { data: dispositions }, { data: callLogs }, { data: thresholdSetting }] =
    await Promise.all([
      supabase.from("users").select("id, name").eq("role", "agent").order("name"),
      supabase.from("call_dispositions").select("id, name, sort_order").order("sort_order"),
      callLogsQuery,
      supabase.from("app_settings").select("value").eq("key", "performance_threshold").single(),
    ]);

  const minCallsPerWeek =
    (thresholdSetting?.value as unknown as PerformanceThreshold | undefined)?.min_calls_per_week ?? 0;
  const weeks = weeksInRange(start, end);
  const expectedCallsForRange = Math.round(minCallsPerWeek * weeks);

  const logs = (callLogs ?? []) as Pick<CallLog, "agent_id" | "disposition_id" | "duration_seconds" | "started_at">[];
  const scopedAgents = agentFilter ? (agents ?? []).filter((a) => a.id === agentFilter) : agents ?? [];

  const agentRows = buildAgentPerformanceRows(scopedAgents, logs, expectedCallsForRange);
  const dispositionRows = buildDispositionBreakdown((dispositions ?? []) as CallDisposition[], logs);
  const timeOfDayRows = buildTimeOfDayHistogram(logs);

  const totalCalls = logs.length;
  const totalDurationSeconds = logs.reduce((sum, l) => sum + l.duration_seconds, 0);
  const avgDurationSeconds = totalCalls > 0 ? totalDurationSeconds / totalCalls : 0;
  const belowThresholdCount = agentRows.filter((r) => r.belowThreshold).length;

  const agentChartData: BarDatum[] = agentRows.map((r) => ({
    key: r.agentId,
    label: r.agentName,
    value: r.callCount,
    displayValue: r.callCount.toString(),
    color: r.belowThreshold ? BELOW_THRESHOLD_COLOR : BAR_COLOR,
    detail:
      expectedCallsForRange > 0
        ? `Target: ${expectedCallsForRange} calls for this range`
        : "No target set",
  }));

  const dispositionChartData: BarDatum[] = dispositionRows.map((d) => ({
    key: d.id,
    label: d.name,
    value: d.count,
    displayValue: d.count.toString(),
    color: BAR_COLOR,
    detail: totalCalls > 0 ? `${Math.round((d.count / totalCalls) * 100)}% of all calls` : "No calls yet",
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">
          Performance Reports
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Call activity by agent for the selected date range.
        </p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <PerformanceReportFilters start={start} end={end} agents={agents ?? []} />
        <ExportCsvButton rows={agentRows} start={start} end={end} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Calls" value={totalCalls.toString()} icon={Phone} accent="brand" />
        <StatCard
          label="Total Duration"
          value={formatDurationHuman(totalDurationSeconds)}
          icon={Clock}
          accent="accent"
        />
        <StatCard
          label="Avg Call Length"
          value={formatDurationHuman(avgDurationSeconds)}
          icon={Timer}
          accent="emerald"
        />
        <StatCard
          label="Agents Below Target"
          value={`${belowThresholdCount} / ${agentRows.length}`}
          icon={AlertTriangle}
          accent="rose"
        />
      </div>

      <Card>
        <CardContent className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Performance Threshold</h3>
          <p className="text-sm text-slate-500">
            Agents who log fewer calls than this weekly target, scaled to the
            selected range, are flagged above and in the table below.
          </p>
          <ThresholdForm minCallsPerWeek={minCallsPerWeek} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <HorizontalBarChart
          title="Calls per agent"
          description="Total calls logged in the selected range"
          data={agentChartData}
          valueColumnLabel="Calls"
          emptyMessage="No agents yet."
        />
        <HorizontalBarChart
          title="Calls by disposition"
          description="Outcomes across all calls in the selected range"
          data={dispositionChartData}
          valueColumnLabel="Calls"
          emptyMessage="No calls logged in this range yet."
        />
      </div>

      <VerticalBarChart
        title="Calls by time of day"
        description="When calls are being made across the selected range"
        data={timeOfDayRows.map((b) => ({ key: b.key, label: b.label, value: b.count }))}
        emptyMessage="No calls logged in this range yet."
      />

      <Card>
        <CardContent className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">By agent</h3>
          {agentRows.length === 0 ? (
            <p className="text-sm text-slate-500">No agents yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                    <th className="py-2 pr-4">Agent</th>
                    <th className="py-2 pr-4">Calls</th>
                    <th className="py-2 pr-4">Total Duration</th>
                    <th className="py-2 pr-4">Avg Duration</th>
                    <th className="py-2 pr-4">Short (&lt;2m)</th>
                    <th className="py-2 pr-4">Medium (2-10m)</th>
                    <th className="py-2 pr-4">Long (&gt;10m)</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {agentRows.map((r) => (
                    <tr key={r.agentId} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 pr-4 font-medium text-slate-900">{r.agentName}</td>
                      <td className="py-2 pr-4 tabular-nums text-slate-700">{r.callCount}</td>
                      <td className="py-2 pr-4 tabular-nums text-slate-700">
                        {formatDurationHuman(r.totalDurationSeconds)}
                      </td>
                      <td className="py-2 pr-4 tabular-nums text-slate-700">
                        {formatDurationHuman(r.avgDurationSeconds)}
                      </td>
                      <td className="py-2 pr-4 tabular-nums text-slate-700">{r.shortCount}</td>
                      <td className="py-2 pr-4 tabular-nums text-slate-700">{r.mediumCount}</td>
                      <td className="py-2 pr-4 tabular-nums text-slate-700">{r.longCount}</td>
                      <td className="py-2">
                        {r.belowThreshold ? (
                          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">
                            Below target
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            On target
                          </span>
                        )}
                      </td>
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
