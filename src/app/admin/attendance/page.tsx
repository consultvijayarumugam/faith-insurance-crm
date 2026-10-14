import { Users, CalendarCheck, Clock3 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/ui/stat-card";
import { ClosedCasesFilters } from "@/components/leads/closed-cases-filters";
import { CorrectionQueue, type CorrectionSessionLocation } from "@/components/attendance/correction-queue";
import { ExportAttendanceCsvButton } from "@/components/attendance/export-attendance-csv-button";
import { LocationCell } from "@/components/attendance/location-cell";
import { LocationRequirementToggle } from "@/components/attendance/location-requirement-toggle";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, formatDateTime, formatDurationHuman, formatMonthLabel } from "@/lib/format";
import type { AttendanceCorrection, AttendanceLocationSetting, AttendanceSession } from "@/types";

function currentMonth() {
  return new Date().toISOString().slice(0, 7); // "YYYY-MM"
}

export default async function AdminAttendancePage({
  searchParams,
}: {
  searchParams: { month?: string; agent?: string };
}) {
  const month = searchParams.month || currentMonth();
  const [year, monthNum] = month.split("-").map(Number);
  const monthStart = `${month}-01`;
  const nextMonth = monthNum === 12 ? `${year + 1}-01` : `${year}-${String(monthNum + 1).padStart(2, "0")}`;
  const monthEnd = `${nextMonth}-01`;

  const supabase = await createClient();

  let sessionsQuery = supabase
    .from("attendance_sessions")
    .select(
      "id, agent_id, work_date, punch_in_at, punch_out_at, punch_in_latitude, punch_in_longitude, punch_in_accuracy_m, punch_in_location_status, punch_out_latitude, punch_out_longitude, punch_out_accuracy_m, punch_out_location_status, created_at"
    )
    .gte("work_date", monthStart)
    .lt("work_date", monthEnd)
    .order("work_date", { ascending: false });
  if (searchParams.agent) sessionsQuery = sessionsQuery.eq("agent_id", searchParams.agent);

  const [{ data: agents }, { data: sessionsData }, { data: pendingCorrectionsData }, { data: locationSettingData }] =
    await Promise.all([
      supabase.from("users").select("id, name").eq("role", "agent").order("name"),
      sessionsQuery,
      supabase
        .from("attendance_corrections")
        .select(
          "id, agent_id, work_date, requested_punch_in_at, requested_punch_out_at, reason, status, reviewed_by, reviewed_at, created_at"
        )
        .eq("status", "pending")
        .order("created_at", { ascending: true }),
      supabase.from("app_settings").select("value").eq("key", "attendance_location").maybeSingle(),
    ]);

  const agentNames = new Map((agents ?? []).map((a) => [a.id, a.name]));

  const sessions: AttendanceSession[] = (sessionsData ?? []).map((s) => ({
    ...s,
    agent_name: agentNames.get(s.agent_id) ?? "Unknown",
  }));
  const pendingCorrections: AttendanceCorrection[] = (pendingCorrectionsData ?? []).map((c) => ({
    ...c,
    agent_name: agentNames.get(c.agent_id) ?? "Unknown",
  }));
  const requireLocation = Boolean(
    (locationSettingData?.value as Partial<AttendanceLocationSetting> | null)?.require_location_for_punch
  );

  // Pending corrections aren't bound by the month filter, so look up their
  // sessions' locations separately rather than relying on `sessions` above.
  const correctionAgentIds = Array.from(new Set(pendingCorrections.map((c) => c.agent_id)));
  const correctionWorkDates = Array.from(new Set(pendingCorrections.map((c) => c.work_date)));
  const { data: correctionSessionsData } =
    correctionAgentIds.length > 0
      ? await supabase
          .from("attendance_sessions")
          .select(
            "agent_id, work_date, punch_in_latitude, punch_in_longitude, punch_in_accuracy_m, punch_in_location_status, punch_out_latitude, punch_out_longitude, punch_out_accuracy_m, punch_out_location_status"
          )
          .in("agent_id", correctionAgentIds)
          .in("work_date", correctionWorkDates)
      : { data: [] as CorrectionSessionLocation[] };
  const sessionLocations = new Map<string, CorrectionSessionLocation>(
    (correctionSessionsData ?? []).map((s) => [`${s.agent_id}|${s.work_date}`, s])
  );

  const totalHoursSeconds = sessions.reduce((sum, s) => {
    if (!s.punch_out_at) return sum;
    return sum + (new Date(s.punch_out_at).getTime() - new Date(s.punch_in_at).getTime()) / 1000;
  }, 0);

  const daysByAgent = new Map<string, number>();
  sessions.forEach((s) => daysByAgent.set(s.agent_id, (daysByAgent.get(s.agent_id) ?? 0) + 1));

  const summaryRows = (agents ?? [])
    .filter((a) => !searchParams.agent || a.id === searchParams.agent)
    .map((a) => {
      const agentSessions = sessions.filter((s) => s.agent_id === a.id);
      const seconds = agentSessions.reduce((sum, s) => {
        if (!s.punch_out_at) return sum;
        return sum + (new Date(s.punch_out_at).getTime() - new Date(s.punch_in_at).getTime()) / 1000;
      }, 0);
      return {
        agentId: a.id,
        agentName: a.name,
        daysPresent: daysByAgent.get(a.id) ?? 0,
        totalHours: formatDurationHuman(seconds),
      };
    });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">Attendance</h2>
        <p className="mt-1 text-sm text-slate-500">
          Monthly punch-clock report per agent, and pending correction requests.
        </p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <ClosedCasesFilters month={month} agents={agents ?? []} />
        <ExportAttendanceCsvButton sessions={sessions} month={month} />
      </div>

      <Card>
        <CardContent>
          <LocationRequirementToggle requireLocation={requireLocation} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label={`Sessions in ${formatMonthLabel(month)}`}
          value={sessions.length.toString()}
          icon={CalendarCheck}
          accent="brand"
        />
        <StatCard
          label="Total Hours Logged"
          value={formatDurationHuman(totalHoursSeconds)}
          icon={Clock3}
          accent="accent"
        />
        <StatCard
          label="Pending Corrections"
          value={pendingCorrections.length.toString()}
          icon={Users}
          accent="rose"
        />
      </div>

      <Card>
        <CardContent className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">By agent</h3>
          {summaryRows.length === 0 ? (
            <p className="text-sm text-slate-500">No agents yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                    <th className="py-2 pr-4">Agent</th>
                    <th className="py-2 pr-4">Days Present</th>
                    <th className="py-2">Total Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryRows.map((r) => (
                    <tr key={r.agentId} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 pr-4 font-medium text-slate-900">{r.agentName}</td>
                      <td className="py-2 pr-4 tabular-nums text-slate-700">{r.daysPresent}</td>
                      <td className="py-2 tabular-nums text-slate-700">{r.totalHours}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <CorrectionQueue corrections={pendingCorrections} sessionLocations={sessionLocations} />

      <Card>
        <CardContent className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">All sessions this month</h3>
          {sessions.length === 0 ? (
            <p className="text-sm text-slate-500">No attendance recorded for this month.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                    <th className="py-2 pr-4">Agent</th>
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Punch In</th>
                    <th className="py-2 pr-4">Punch Out</th>
                    <th className="py-2">Location</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 pr-4 font-medium text-slate-900">{s.agent_name}</td>
                      <td className="py-2 pr-4 text-slate-700">{formatDate(s.work_date)}</td>
                      <td className="py-2 pr-4 text-slate-700">{formatDateTime(s.punch_in_at)}</td>
                      <td className="py-2 pr-4 text-slate-700">
                        {s.punch_out_at ? formatDateTime(s.punch_out_at) : "—"}
                      </td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-3">
                          <LocationCell
                            label="In"
                            status={s.punch_in_location_status}
                            latitude={s.punch_in_latitude}
                            longitude={s.punch_in_longitude}
                            accuracyM={s.punch_in_accuracy_m}
                          />
                          {s.punch_out_at && (
                            <LocationCell
                              label="Out"
                              status={s.punch_out_location_status}
                              latitude={s.punch_out_latitude}
                              longitude={s.punch_out_longitude}
                              accuracyM={s.punch_out_accuracy_m}
                            />
                          )}
                        </div>
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
