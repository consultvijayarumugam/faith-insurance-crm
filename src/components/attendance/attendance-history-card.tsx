import { Card, CardContent } from "@/components/ui/card";
import { formatDate, formatDateTime } from "@/lib/format";
import { LocationCell } from "@/components/attendance/location-cell";
import type { AttendanceCorrection, AttendanceSession } from "@/types";

const STATUS_BADGE: Record<AttendanceCorrection["status"], string> = {
  pending: "bg-warning-50 text-warning-700",
  approved: "bg-success-50 text-success-700",
  rejected: "bg-danger-50 text-danger-700",
};

export function AttendanceHistoryCard({
  sessions,
  corrections,
}: {
  sessions: AttendanceSession[];
  corrections: AttendanceCorrection[];
}) {
  return (
    <Card>
      <CardContent className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">History</h3>
          {sessions.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No attendance recorded yet.</p>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Punch In</th>
                    <th className="py-2 pr-4">Punch Out</th>
                    <th className="py-2">Location</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.id} className="border-b border-slate-100 last:border-0">
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
        </div>

        {corrections.length > 0 && (
          <div className="border-t border-slate-100 pt-5">
            <h3 className="text-sm font-semibold text-slate-900">Your Correction Requests</h3>
            <ul className="mt-2 space-y-2">
              {corrections.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-slate-200 p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">{formatDate(c.work_date)}</p>
                    <p className="text-sm text-slate-600">{c.reason}</p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[c.status]}`}
                  >
                    {c.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
