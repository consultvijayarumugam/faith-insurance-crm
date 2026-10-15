import Link from "next/link";
import { Contact, CheckCircle2, Wallet, ArrowRight, Phone, CalendarClock, PhoneCall, Cake } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { GreetingHeader } from "@/components/dashboard/greeting-header";
import { formatCurrency } from "@/lib/format";
import { isBirthdayToday } from "@/lib/utils";
import type { PerformanceThreshold } from "@/types";

export default async function AgentDashboardPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const todayStart = `${today}T00:00:00.000Z`;
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);

  // RLS scopes every query here to the signed-in agent's own rows automatically.
  const [
    { data: leads },
    { data: followUps },
    { data: profile },
    { count: callsToday },
    { count: callsThisWeek },
    { data: thresholdSetting },
  ] = await Promise.all([
    supabase.from("leads").select("status:lead_statuses(is_won, is_lost), converted, value"),
    supabase
      .from("leads")
      .select("id, name, mobile_number")
      .eq("next_follow_up_date", today)
      .order("name"),
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return { data: null };
      return supabase.from("users").select("name, birthday").eq("id", user.id).single();
    }),
    supabase.from("call_logs").select("id", { count: "exact", head: true }).gte("started_at", todayStart),
    supabase
      .from("call_logs")
      .select("id", { count: "exact", head: true })
      .gte("started_at", weekStart.toISOString()),
    supabase.from("app_settings").select("value").eq("key", "performance_threshold").maybeSingle(),
  ]);

  const weeklyTarget =
    (thresholdSetting?.value as unknown as PerformanceThreshold | undefined)?.min_calls_per_week ?? 0;
  const hasBirthdayToday = isBirthdayToday(profile?.birthday ?? null);

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
      <GreetingHeader name={profile?.name ?? "there"} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-soft">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <CalendarClock className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xs text-slate-400">Due today</p>
            <p className="text-sm font-semibold text-slate-900">
              {followUps?.length ?? 0} follow-up{(followUps?.length ?? 0) === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-soft">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-50 text-accent-700">
            <PhoneCall className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xs text-slate-400">
              Calls today{weeklyTarget > 0 ? ` · week ${callsThisWeek ?? 0}/${weeklyTarget}` : ""}
            </p>
            <p className="text-sm font-semibold text-slate-900">{callsToday ?? 0} logged</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-soft">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warning-50 text-warning-600">
            <Cake className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xs text-slate-400">Today</p>
            <p className="text-sm font-semibold text-slate-900">
              {hasBirthdayToday ? "It's your birthday! 🎉" : "No birthdays today"}
            </p>
          </div>
        </div>
      </div>

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
            <EmptyState
              icon={CalendarClock}
              title="No follow-ups due today"
              description="Nice and clear — check back tomorrow or browse your leads."
            />
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
