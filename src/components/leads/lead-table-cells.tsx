import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Plain ISO ("YYYY-MM-DD") strings compare correctly with `<`/`>=`, so no
 * date parsing is needed to tell "due today or earlier" apart from future. */
export function FollowUpCell({ date }: { date: string | null }) {
  if (!date) return <span className="text-sm text-slate-400">—</span>;

  const today = new Date().toISOString().slice(0, 10);
  const isDueOrOverdue = date <= today;

  return (
    <span
      className={cn(
        "text-sm",
        isDueOrOverdue ? "font-medium text-amber-700" : "text-slate-600"
      )}
    >
      {formatDate(date)}
    </span>
  );
}

export function ProposalCell({
  amount,
  sentDate,
}: {
  amount: number | null;
  sentDate: string | null;
}) {
  if (amount === null && !sentDate) {
    return <span className="text-sm text-slate-400">—</span>;
  }

  return (
    <div>
      <p className="text-sm font-medium text-slate-900">
        {amount !== null ? formatCurrency(amount) : "—"}
      </p>
      {sentDate && <p className="text-xs text-slate-400">{formatDate(sentDate)}</p>}
    </div>
  );
}
