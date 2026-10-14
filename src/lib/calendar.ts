import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  isSameMonth,
  format,
} from "date-fns";
import type { LeadFollowUpStatus } from "@/types";

export type CalendarView = "month" | "week";

const WEEK_STARTS_ON = 1 as const; // Monday

export interface CalendarRange {
  view: CalendarView;
  gridStart: Date;
  gridEnd: Date;
  days: Date[];
  prevDate: string;
  nextDate: string;
  todayDate: string;
  label: string;
  isInRange: (d: Date) => boolean;
}

export function getCalendarRange(view: CalendarView, anchorStr?: string): CalendarRange {
  const anchor = anchorStr && !Number.isNaN(Date.parse(anchorStr)) ? new Date(anchorStr) : new Date();
  const todayDate = format(new Date(), "yyyy-MM-dd");

  if (view === "week") {
    const gridStart = startOfWeek(anchor, { weekStartsOn: WEEK_STARTS_ON });
    const gridEnd = endOfWeek(anchor, { weekStartsOn: WEEK_STARTS_ON });
    return {
      view,
      gridStart,
      gridEnd,
      days: eachDayOfInterval({ start: gridStart, end: gridEnd }),
      prevDate: format(subWeeks(anchor, 1), "yyyy-MM-dd"),
      nextDate: format(addWeeks(anchor, 1), "yyyy-MM-dd"),
      todayDate,
      label: `${format(gridStart, "d MMM")} – ${format(gridEnd, "d MMM yyyy")}`,
      isInRange: () => true,
    };
  }

  const monthStart = startOfMonth(anchor);
  const monthEnd = endOfMonth(anchor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: WEEK_STARTS_ON });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: WEEK_STARTS_ON });

  return {
    view,
    gridStart,
    gridEnd,
    days: eachDayOfInterval({ start: gridStart, end: gridEnd }),
    prevDate: format(subMonths(anchor, 1), "yyyy-MM-dd"),
    nextDate: format(addMonths(anchor, 1), "yyyy-MM-dd"),
    todayDate,
    label: format(anchor, "MMMM yyyy"),
    isInRange: (d: Date) => isSameMonth(d, anchor),
  };
}

export interface CalendarEvent {
  id: string;
  leadId: string;
  leadName: string;
  scheduledAt: string;
  status: LeadFollowUpStatus;
}

export function groupEventsByDay(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const key = e.scheduledAt.slice(0, 10);
    const list = map.get(key) ?? [];
    list.push(e);
    map.set(key, list);
  }
  Array.from(map.values()).forEach((list) => {
    list.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  });
  return map;
}
