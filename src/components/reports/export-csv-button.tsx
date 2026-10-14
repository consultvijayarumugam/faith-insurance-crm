"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AgentPerformanceRow } from "@/lib/actions/reports";

function csvField(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function ExportCsvButton({
  rows,
  start,
  end,
}: {
  rows: AgentPerformanceRow[];
  start: string;
  end: string;
}) {
  function handleExport() {
    const header = [
      "Agent",
      "Calls",
      "Total duration (sec)",
      "Avg duration (sec)",
      "Short calls (<2m)",
      "Medium calls (2-10m)",
      "Long calls (>10m)",
      "Below threshold",
    ];
    const lines = [
      header.join(","),
      ...rows.map((r) =>
        [
          csvField(r.agentName),
          csvField(r.callCount),
          csvField(Math.round(r.totalDurationSeconds)),
          csvField(Math.round(r.avgDurationSeconds)),
          csvField(r.shortCount),
          csvField(r.mediumCount),
          csvField(r.longCount),
          csvField(r.belowThreshold ? "Yes" : "No"),
        ].join(",")
      ),
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `performance-${start}-to-${end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button type="button" variant="secondary" size="sm" onClick={handleExport} disabled={rows.length === 0}>
      <Download className="h-3.5 w-3.5" />
      Export CSV
    </Button>
  );
}
