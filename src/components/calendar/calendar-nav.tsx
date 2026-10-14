"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { CalendarView } from "@/lib/calendar";

export function CalendarNav({
  label,
  prevDate,
  nextDate,
  todayDate,
  view,
  agents,
}: {
  label: string;
  prevDate: string;
  nextDate: string;
  todayDate: string;
  view: CalendarView;
  /** Present only on the admin calendar — its presence renders the agent
   * filter dropdown. */
  agents?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const agent = searchParams.get("agent") ?? "";

  function go(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={() => go({ date: prevDate })}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => go({ date: todayDate })}>
          Today
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => go({ date: nextDate })}>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
        <h2 className="ml-2 text-lg font-semibold tracking-tight text-slate-900">{label}</h2>
      </div>

      <div className="flex items-center gap-2">
        {agents && (
          <Select
            value={agent}
            onChange={(e) => go({ agent: e.target.value })}
            className="h-8 w-44 py-0 text-xs"
          >
            <option value="">All agents</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        )}
        <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
          {(["month", "week"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => go({ view: v })}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors",
                view === v ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100"
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
