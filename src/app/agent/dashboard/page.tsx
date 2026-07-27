import Link from "next/link";
import { Contact, CheckCircle2, Wallet, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/ui/stat-card";
import { formatCurrency } from "@/lib/format";

export default async function AgentDashboardPage() {
  const supabase = await createClient();

  // RLS scopes this to the signed-in agent's own leads automatically.
  const { data: leads } = await supabase
    .from("leads")
    .select("lead_status, converted, value");

  const rows = leads ?? [];
  const totalLeads = rows.length;
  const convertedCount = rows.filter((l) => l.converted).length;
  const pipelineValue = rows
    .filter((l) => l.lead_status !== "Converted" && l.lead_status !== "Lost")
    .reduce((sum, l) => sum + Number(l.value ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Leads"
          value={totalLeads.toString()}
          icon={Contact}
          accent="brand"
        />
        <StatCard
          label="Converted"
          value={convertedCount.toString()}
          icon={CheckCircle2}
          accent="emerald"
        />
        <StatCard
          label="Pipeline Value"
          value={formatCurrency(pipelineValue)}
          icon={Wallet}
          accent="accent"
        />
      </div>

      <Link
        href="/agent/leads"
        className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 text-sm font-medium text-slate-700 shadow-soft transition-colors hover:bg-slate-50"
      >
        View and filter your full leads list
        <ArrowRight className="h-4 w-4 text-slate-400" />
      </Link>
    </div>
  );
}
