"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MonthlyAgentTotalRow } from "@/lib/actions/allowance-reports";

function csvField(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function ExportAllowanceCsvButton({ rows }: { rows: MonthlyAgentTotalRow[] }) {
  function handleExport() {
    const header = ["Agent", "Month", "Status", "KM", "Claimed", "Approved", "Paid"];
    const lines = [
      header.join(","),
      ...rows.map((r) =>
        [
          csvField(r.agentName),
          csvField(r.month.slice(0, 7)),
          csvField(r.status),
          csvField(r.km),
          csvField(r.claimed.toFixed(2)),
          csvField(r.approved.toFixed(2)),
          csvField(r.paid.toFixed(2)),
        ].join(",")
      ),
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `allowance-report.csv`;
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
