import { Award, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/ui/stat-card";
import { ClosedCasesFilters } from "@/components/leads/closed-cases-filters";
import { AdminLeadsTable } from "@/components/leads/admin-leads-table";
import { formatCurrency, formatMonthLabel } from "@/lib/format";
import type { Lead } from "@/types";

function currentMonth() {
  return new Date().toISOString().slice(0, 7); // "YYYY-MM"
}

export default async function AdminClosedCasesPage(
  props: {
    searchParams: Promise<{ month?: string; agent?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const month = searchParams.month || currentMonth();
  const monthStart = `${month}-01T00:00:00.000Z`;
  const [year, monthNum] = month.split("-").map(Number);
  const nextMonth = monthNum === 12 ? `${year + 1}-01` : `${year}-${String(monthNum + 1).padStart(2, "0")}`;
  const monthEnd = `${nextMonth}-01T00:00:00.000Z`;

  const supabase = await createClient();

  let query = supabase
    .from("leads")
    .select(
      "id, agent_id, name, mobile_number, email, product_pitched, value, status_id, status:lead_statuses(*), converted, converted_at, policy_start_date, policy_end_date, next_follow_up_date, proposal_amount, proposal_sent_date, proposal_notes, created_at, updated_at"
    )
    .eq("converted", true)
    .gte("converted_at", monthStart)
    .lt("converted_at", monthEnd)
    .order("converted_at", { ascending: false });

  if (searchParams.agent) {
    query = query.eq("agent_id", searchParams.agent);
  }

  const [{ data: leads }, { data: agents }] = await Promise.all([
    query,
    supabase.from("users").select("id, name").eq("role", "agent").order("name"),
  ]);

  const rows = (leads ?? []) as unknown as Lead[];
  const totalValue = rows.reduce((sum, l) => sum + Number(l.value ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">Closed Cases</h2>
        <p className="mt-1 text-sm text-slate-500">
          Leads that were won (converted), filtered by the month they closed in.
        </p>
      </div>

      <ClosedCasesFilters month={month} agents={agents ?? []} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          label={`Closed in ${formatMonthLabel(month)}`}
          value={rows.length.toString()}
          icon={Award}
          accent="emerald"
        />
        <StatCard label="Total value" value={formatCurrency(totalValue)} icon={Wallet} accent="accent" />
      </div>

      <AdminLeadsTable leads={rows} agents={agents ?? []} />
    </div>
  );
}
