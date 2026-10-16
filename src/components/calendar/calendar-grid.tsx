import Link from "next/link";
import { format, isSameDay } from "date-fns";
import type { CalendarEvent, CalendarView } from "@/lib/calendar";
import { cn } from "@/lib/utils";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const STATUS_DOT: Record<CalendarEvent["status"], string> = {
  pending: "bg-brand-500",
  done: "bg-success-500",
  missed: "bg-danger-500",
};

export function CalendarGrid({
  view,
  days,
  eventsByDay,
  isInRange,
  detailBasePath,
}: {
  view: CalendarView;
  days: Date[];
  eventsByDay: Map<string, CalendarEvent[]>;
  isInRange: (d: Date) => boolean;
  detailBasePath: string;
}) {
  const today = new Date();

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-card">
      <div className="grid min-w-[700px] grid-cols-7 border-b border-slate-200 text-xs font-medium uppercase tracking-wide text-slate-400">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className="px-3 py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid min-w-[700px] grid-cols-7">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const events = eventsByDay.get(key) ?? [];
          const dimmed = !isInRange(day);
          const isToday = isSameDay(day, today);

          return (
            <div
              key={key}
              className={cn(
                "border-b border-r border-slate-100 p-2",
                view === "month" ? "min-h-[110px]" : "min-h-[220px]",
                dimmed && "bg-slate-50/60"
              )}
            >
              <p
                className={cn(
                  "mb-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium",
                  isToday
                    ? "bg-brand-600 text-white"
                    : dimmed
                      ? "text-slate-300"
                      : "text-slate-500"
                )}
              >
                {format(day, "d")}
              </p>
              <div className="space-y-1">
                {events.map((e) => (
                  <Link
                    key={e.id}
                    href={`${detailBasePath}/${e.leadId}`}
                    className="flex items-center gap-1 truncate rounded px-1.5 py-1 text-[11px] text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                    title={`${e.leadName} — ${format(new Date(e.scheduledAt), "p")}`}
                  >
                    <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOT[e.status])} />
                    <span className="truncate">
                      {format(new Date(e.scheduledAt), "HH:mm")} {e.leadName}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
