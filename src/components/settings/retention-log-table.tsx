import { formatDateTime } from "@/lib/format";
import type { RetentionLog } from "@/types";

const MODE_BADGE: Record<RetentionLog["mode"], string> = {
  dry_run: "bg-slate-100 text-slate-600",
  live: "bg-rose-50 text-rose-700",
};

function summarizeCounts(counts: Record<string, number>): string {
  const nonZero = Object.entries(counts).filter(([, n]) => n > 0);
  if (nonZero.length === 0) return "Nothing eligible";
  return nonZero.map(([table, n]) => `${table}: ${n}`).join(" · ");
}

export function RetentionLogTable({ logs }: { logs: RetentionLog[] }) {
  if (logs.length === 0) {
    return <p className="text-sm text-slate-500">No retention runs yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
            <th className="py-2 pr-4">Run</th>
            <th className="py-2 pr-4">Mode</th>
            <th className="py-2 pr-4">Triggered by</th>
            <th className="py-2">Counts</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-b border-slate-100 last:border-0">
              <td className="py-2 pr-4 text-slate-700">{formatDateTime(log.run_at)}</td>
              <td className="py-2 pr-4">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${MODE_BADGE[log.mode]}`}>
                  {log.mode === "dry_run" ? "Dry run" : "Live"}
                </span>
              </td>
              <td className="py-2 pr-4 text-slate-700">{log.triggered_by === "cron" ? "Cron" : "Manual"}</td>
              <td className="py-2 text-slate-700">{summarizeCounts(log.counts)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
