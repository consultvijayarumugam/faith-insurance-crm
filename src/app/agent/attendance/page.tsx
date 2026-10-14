import { createClient } from "@/lib/supabase/server";
import { PunchCard } from "@/components/attendance/punch-card";
import { CorrectionForm } from "@/components/attendance/correction-form";
import { AttendanceHistoryCard } from "@/components/attendance/attendance-history-card";
import { getWorkDateIST } from "@/lib/attendance";
import type { AttendanceCorrection, AttendanceSession } from "@/types";

export default async function AgentAttendancePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const today = getWorkDateIST();

  const [{ data: todaySession }, { data: sessions }, { data: corrections }] = await Promise.all([
    supabase
      .from("attendance_sessions")
      .select("punch_in_at, punch_out_at")
      .eq("agent_id", user?.id ?? "")
      .eq("work_date", today)
      .maybeSingle(),
    supabase
      .from("attendance_sessions")
      .select(
        "id, agent_id, work_date, punch_in_at, punch_out_at, punch_in_latitude, punch_in_longitude, punch_in_accuracy_m, punch_in_location_status, punch_out_latitude, punch_out_longitude, punch_out_accuracy_m, punch_out_location_status, created_at"
      )
      .eq("agent_id", user?.id ?? "")
      .order("work_date", { ascending: false })
      .limit(30),
    supabase
      .from("attendance_corrections")
      .select(
        "id, agent_id, work_date, requested_punch_in_at, requested_punch_out_at, reason, status, reviewed_by, reviewed_at, created_at"
      )
      .eq("agent_id", user?.id ?? "")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">Attendance</h2>
        <p className="mt-1 text-sm text-slate-500">Punch in and out, and review your history.</p>
      </div>

      <PunchCard
        punchInAt={todaySession?.punch_in_at ?? null}
        punchOutAt={todaySession?.punch_out_at ?? null}
      />

      <CorrectionForm />

      <AttendanceHistoryCard
        sessions={(sessions ?? []) as AttendanceSession[]}
        corrections={(corrections ?? []) as AttendanceCorrection[]}
      />
    </div>
  );
}
