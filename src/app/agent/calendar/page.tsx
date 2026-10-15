import { createClient } from "@/lib/supabase/server";
import { getCalendarRange, groupEventsByDay, type CalendarEvent } from "@/lib/calendar";
import { CalendarNav } from "@/components/calendar/calendar-nav";
import { CalendarGrid } from "@/components/calendar/calendar-grid";
import type { LeadFollowUpStatus } from "@/types";

export default async function AgentCalendarPage(
  props: {
    searchParams: Promise<{ view?: string; date?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const view = searchParams.view === "week" ? "week" : "month";
  const range = getCalendarRange(view, searchParams.date);
  const supabase = await createClient();

  // RLS (lead_follow_ups_select) already scopes this to the signed-in
  // agent's own leads' follow-ups — no explicit agent filter needed here.
  const { data: rows } = await supabase
    .from("lead_follow_ups")
    .select("id, lead_id, scheduled_at, status, lead:leads(name)")
    .gte("scheduled_at", range.gridStart.toISOString())
    .lte("scheduled_at", range.gridEnd.toISOString())
    .order("scheduled_at");

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
      />
      <CalendarGrid
        view={view}
        days={range.days}
        eventsByDay={groupEventsByDay(events)}
        isInRange={range.isInRange}
        detailBasePath="/agent/leads"
      />
    </div>
  );
}
