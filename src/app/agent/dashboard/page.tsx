import Link from "next/link";
import { Contact, CheckCircle2, Wallet, ArrowRight, Phone, CalendarClock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";

export default async function AgentDashboardPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  // RLS scopes both queries to the signed-in agent's own leads automatically.
  const [{ data: leads }, { data: followUps }] = await Promise.all([
    supabase.from("leads").select("status:lead_statuses(is_won, is_lost), converted, value"),
    supabase
      .from("leads")
      .select("id, name, mobile_number")
      .eq("next_follow_up_date", today)
      .order("name"),
  ]);

  const rows = (leads ?? []) as unknown as {
    status: { is_won: boolean; is_lost: boolean } | null;
    converted: boolean;
    value: number;
  }[];
  const totalLeads = rows.length;
  const convertedCount = rows.filter((l) => l.converted).length;
  const pipelineValue = rows
    .filter((l) => !l.status?.is_won && !l.status?.is_lost)
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

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
          <CalendarClock className="h-4 w-4 text-slate-400" />
          <CardTitle>Today&apos;s Follow-ups</CardTitle>
        </CardHeader>
        <CardContent>
          {!followUps || followUps.length === 0 ? (
            <p className="py-2 text-sm text-slate-500">
              No follow-ups due today. Nice and clear.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {followUps.map((lead) => (
                <li key={lead.id}>
                  <Link
                    href={`/agent/leads/${lead.id}`}
                    className="flex items-center justify-between py-2.5 text-sm hover:text-brand-700"
                  >
                    <span className="font-medium text-slate-900">{lead.name}</span>
                    <span className="flex items-center gap-1 text-slate-400">
                      <Phone className="h-3 w-3" />
                      {lead.mobile_number}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

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
