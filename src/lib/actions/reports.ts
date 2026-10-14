// Read-only aggregation helpers for the admin performance report. These are
// plain functions (no "use server") — they're only ever called from the
// report's Server Component after it has already fetched rows with the
// server Supabase client, not invoked directly as a form action.

import type { CallDisposition, CallLog } from "@/types";

const SHORT_MAX_SECONDS = 120; // < 2 min
const MEDIUM_MAX_SECONDS = 600; // 2-10 min, anything above is "long"

export interface AgentPerformanceRow {
  agentId: string;
  agentName: string;
  callCount: number;
  totalDurationSeconds: number;
  avgDurationSeconds: number;
  shortCount: number;
  mediumCount: number;
  longCount: number;
  belowThreshold: boolean;
}

export function buildAgentPerformanceRows(
  agents: { id: string; name: string }[],
  callLogs: Pick<CallLog, "agent_id" | "duration_seconds">[],
  expectedCallsForRange: number
): AgentPerformanceRow[] {
  const byAgent = new Map<string, Pick<CallLog, "agent_id" | "duration_seconds">[]>();
  callLogs.forEach((log) => {
    const list = byAgent.get(log.agent_id) ?? [];
    list.push(log);
    byAgent.set(log.agent_id, list);
  });

  return agents
    .map((agent) => {
      const logs = byAgent.get(agent.id) ?? [];
      const callCount = logs.length;
      const totalDurationSeconds = logs.reduce((sum, l) => sum + l.duration_seconds, 0);
      const shortCount = logs.filter((l) => l.duration_seconds < SHORT_MAX_SECONDS).length;
      const mediumCount = logs.filter(
        (l) => l.duration_seconds >= SHORT_MAX_SECONDS && l.duration_seconds <= MEDIUM_MAX_SECONDS
      ).length;
      const longCount = logs.filter((l) => l.duration_seconds > MEDIUM_MAX_SECONDS).length;

      return {
        agentId: agent.id,
        agentName: agent.name,
        callCount,
        totalDurationSeconds,
        avgDurationSeconds: callCount > 0 ? totalDurationSeconds / callCount : 0,
        shortCount,
        mediumCount,
        longCount,
        belowThreshold: callCount < expectedCallsForRange,
      };
    })
    .sort((a, b) => b.callCount - a.callCount);
}

export interface DispositionBreakdownRow {
  id: string;
  name: string;
  count: number;
}

export function buildDispositionBreakdown(
  dispositions: CallDisposition[],
  callLogs: Pick<CallLog, "disposition_id">[]
): DispositionBreakdownRow[] {
  const counts = new Map<string, number>();
  callLogs.forEach((l) => counts.set(l.disposition_id, (counts.get(l.disposition_id) ?? 0) + 1));

  return dispositions
    .map((d) => ({ id: d.id, name: d.name, count: counts.get(d.id) ?? 0 }))
    .sort((a, b) => b.count - a.count);
}

const TIME_OF_DAY_BUCKETS = [
  { key: "morning", label: "Morning (6am–12pm)", test: (h: number) => h >= 6 && h < 12 },
  { key: "afternoon", label: "Afternoon (12pm–5pm)", test: (h: number) => h >= 12 && h < 17 },
  { key: "evening", label: "Evening (5pm–9pm)", test: (h: number) => h >= 17 && h < 21 },
  { key: "night", label: "Night (9pm–6am)", test: (h: number) => h >= 21 || h < 6 },
] as const;

export interface TimeOfDayBucket {
  key: string;
  label: string;
  count: number;
}

export function buildTimeOfDayHistogram(
  callLogs: Pick<CallLog, "started_at">[]
): TimeOfDayBucket[] {
  const hours = callLogs.map((l) => new Date(l.started_at).getHours());
  return TIME_OF_DAY_BUCKETS.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    count: hours.filter((h) => bucket.test(h)).length,
  }));
}

/** Number of 7-day weeks spanned by an inclusive [start, end] date range, minimum 1. */
export function weeksInRange(startDate: string, endDate: string): number {
  const ms = new Date(`${endDate}T00:00:00`).getTime() - new Date(`${startDate}T00:00:00`).getTime();
  const days = Math.max(1, Math.round(ms / 86_400_000) + 1);
  return Math.max(1, days / 7);
}
