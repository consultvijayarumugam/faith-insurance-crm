import { CheckCircle2, Clock3, FileEdit, IndianRupee, XCircle } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import type { AllowanceClaim } from "@/types";

const STATUS_META: Record<
  AllowanceClaim["status"],
  { label: string; className: string; icon: typeof Clock3 }
> = {
  draft: { label: "Draft — not yet submitted", className: "bg-slate-100 text-slate-600", icon: FileEdit },
  submitted: { label: "Submitted — awaiting review", className: "bg-amber-50 text-amber-700", icon: Clock3 },
  approved: { label: "Approved", className: "bg-success-50 text-success-700", icon: CheckCircle2 },
  partially_approved: {
    label: "Partially approved — some lines need fixing",
    className: "bg-warning-50 text-warning-700",
    icon: Clock3,
  },
  rejected: { label: "Rejected", className: "bg-danger-50 text-danger-700", icon: XCircle },
  paid: { label: "Paid", className: "bg-success-50 text-success-700", icon: IndianRupee },
};

export function ClaimStatusBanner({ claim }: { claim: AllowanceClaim | null }) {
  if (!claim) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-500">
        <FileEdit className="h-4 w-4" />
        No entries yet for this month.
      </div>
    );
  }

  const meta = STATUS_META[claim.status];
  const Icon = meta.icon;

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 ${meta.className}`}>
      <span className="flex items-center gap-2 text-sm font-medium">
        <Icon className="h-4 w-4" />
        {meta.label}
      </span>
      <span className="text-sm">
        {claim.total_km} km · {formatCurrency(claim.total_claimed_amount)} claimed
        {claim.status !== "draft" && claim.status !== "submitted" && (
          <> · {formatCurrency(claim.total_approved_amount)} approved</>
        )}
      </span>
    </div>
  );
}
