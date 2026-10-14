"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AttendanceSession } from "@/types";

function csvField(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function ExportAttendanceCsvButton({
  sessions,
  month,
}: {
  sessions: AttendanceSession[];
  month: string;
}) {
  function handleExport() {
    const header = [
      "Agent",
      "Date",
      "Punch In",
      "Punch Out",
      "Punch In Location",
      "Punch In Accuracy (m)",
      "Punch Out Location",
      "Punch Out Accuracy (m)",
    ];
    const lines = [
      header.join(","),
      ...sessions.map((s) =>
        [
          csvField(s.agent_name ?? "Unknown"),
          csvField(s.work_date),
          csvField(s.punch_in_at),
          csvField(s.punch_out_at ?? ""),
          csvField(
            s.punch_in_location_status === "captured"
              ? `${s.punch_in_latitude},${s.punch_in_longitude}`
              : s.punch_in_location_status ?? ""
          ),
          csvField(s.punch_in_accuracy_m ?? ""),
          csvField(
            s.punch_out_location_status === "captured"
              ? `${s.punch_out_latitude},${s.punch_out_longitude}`
              : s.punch_out_location_status ?? ""
          ),
          csvField(s.punch_out_accuracy_m ?? ""),
        ].join(",")
      ),
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={handleExport}
      disabled={sessions.length === 0}
    >
      <Download className="h-3.5 w-3.5" />
      Export CSV
    </Button>
  );
}
