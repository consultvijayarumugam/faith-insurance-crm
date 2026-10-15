import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatMonthLabel } from "@/lib/format";
import { getMonthIST } from "@/lib/allowance";
import type { AllowanceClaimStatus } from "@/types";

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  submitted: "bg-warning-50 text-warning-700",
  approved: "bg-success-50 text-success-700",
  partially_approved: "bg-warning-50 text-warning-700",
  rejected: "bg-danger-50 text-danger-700",
  paid: "bg-success-50 text-success-700",
};

export default async function AdminAllowancesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; agent?: string; status?: string }>;
}) {
  const params = await searchParams;
  const month = params.month ?? "";
  const supabase = await createClient();

  const [{ data: agents }, { count: rateCount }] = await Promise.all([
    supabase.from("users").select("id, name").eq("role", "agent").order("name"),
    supabase.from("allowance_rates").select("id", { count: "exact", head: true }),
  ]);

  let query = supabase
    .from("allowance_claims")
    .select("id, agent_id, month, status, total_km, total_claimed_amount, total_approved_amount, submitted_at")
    .neq("status", "draft")
    .order("month", { ascending: false });

  if (month) query = query.eq("month", `${month}-01`);
  if (params.agent) query = query.eq("agent_id", params.agent);
  if (params.status) query = query.eq("status", params.status as AllowanceClaimStatus);

  const { data: claims } = await query;

  const agentNames = new Map((agents ?? []).map((a) => [a.id, a.name]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">Allowance Claims</h2>
          <p className="mt-1 text-sm text-slate-500">Review submitted claims, approve or reject each line.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/allowances/report">
            <Button type="button" variant="secondary" size="sm">
              Report
            </Button>
          </Link>
          <Link href="/admin/allowances/settings">
            <Button type="button" variant="secondary" size="sm">
              Settings
            </Button>
          </Link>
        </div>
      </div>

      {!rateCount && (
        <Alert variant="warning">
          <p>No travel rates are configured yet — agents won&apos;t be able to log entries until you add at least one.</p>
          <Link href="/admin/allowances/settings" className="mt-1 inline-block font-medium underline">
            Add your first rate
          </Link>
        </Alert>
      )}

      <form className="flex flex-wrap items-end gap-3" method="get">
        <div className="w-40 space-y-1.5">
          <Label htmlFor="month">Month</Label>
          <input
            id="month"
            name="month"
            type="month"
            defaultValue={month}
            max={getMonthIST()}
            className="flex h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-soft"
          />
        </div>
        <div className="w-48 space-y-1.5">
          <Label htmlFor="agent">Agent</Label>
          <Select id="agent" name="agent" defaultValue={params.agent ?? ""}>
            <option value="">All agents</option>
            {(agents ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-48 space-y-1.5">
          <Label htmlFor="status">Status</Label>
          <Select id="status" name="status" defaultValue={params.status ?? ""}>
            <option value="">All statuses</option>
            <option value="submitted">Submitted</option>
            <option value="approved">Approved</option>
            <option value="partially_approved">Partially approved</option>
            <option value="rejected">Rejected</option>
            <option value="paid">Paid</option>
          </Select>
        </div>
        <Button type="submit" size="sm" variant="secondary">
          Filter
        </Button>
      </form>

      {!claims || claims.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No claims match these filters" />
      ) : (
        <div className="space-y-2">
          {claims.map((c) => (
            <Link
              key={c.id}
              href={`/admin/allowances/${c.id}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-soft transition-colors hover:bg-slate-50"
            >
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {agentNames.get(c.agent_id) ?? "Unknown"}
                  <span className="ml-2 text-xs font-normal text-slate-400">{formatMonthLabel(c.month.slice(0, 7))}</span>
                </p>
                <p className="text-xs text-slate-500">
                  {c.total_km} km · {formatCurrency(c.total_claimed_amount)} claimed
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGE[c.status]}`}>
                {c.status.replace("_", " ")}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
