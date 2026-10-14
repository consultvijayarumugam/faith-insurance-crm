import { createClient } from "@/lib/supabase/server";
import { getCalendarRange, groupEventsByDay, type CalendarEvent } from "@/lib/calendar";
import { CalendarNav } from "@/components/calendar/calendar-nav";
import { CalendarGrid } from "@/components/calendar/calendar-grid";
import type { LeadFollowUpStatus } from "@/types";

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams: { view?: string; date?: string; agent?: string };
}) {
  const view = searchParams.view === "week" ? "week" : "month";
  const range = getCalendarRange(view, searchParams.date);
  const supabase = await createClient();

  let query = supabase
    .from("lead_follow_ups")
    .select("id, lead_id, agent_id, scheduled_at, status, lead:leads(name)")
    .gte("scheduled_at", range.gridStart.toISOString())
    .lte("scheduled_at", range.gridEnd.toISOString())
    .order("scheduled_at");

  if (searchParams.agent) {
    query = query.eq("agent_id", searchParams.agent);
  }

  const [{ data: rows }, { data: agents }] = await Promise.all([
    query,
    supabase.from("users").select("id, name").eq("role", "agent").order("name"),
  ]);

  const events: CalendarEvent[] = (rows ?? []).map((r) => ({
    id: r.id,
    leadId: r.lead_id,
    leadName: (r.lead as unknown as { name: string } | null)?.name ?? "Unknown lead",
    scheduledAt: r.scheduled_at,
    status: r.status as LeadFollowUpStatus,
  }));

  return (
    <div className="space-y-4">
      <CalendarNav
        label={range.label}
        prevDate={range.prevDate}
        nextDate={range.nextDate}
        todayDate={range.todayDate}
        view={view}
        agents={agents ?? []}
      />
      <CalendarGrid
        view={view}
        days={range.days}
        eventsByDay={groupEventsByDay(events)}
        isInRange={range.isInRange}
        detailBasePath="/admin/leads"
      />
    </div>
  );
}
