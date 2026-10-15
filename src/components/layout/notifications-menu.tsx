"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, CalendarClock, Cake, Receipt } from "lucide-react";
import type { Role } from "./nav-items";

export function NotificationsMenu({
  role,
  followUpCount,
  birthdays,
  allowanceCount = 0,
  allowanceMessage,
  monthEndReminder = false,
}: {
  role: Role;
  followUpCount: number;
  birthdays: { id: string; name: string }[];
  /** Admin: claims awaiting review. Agent: claims just decided, not yet paid. */
  allowanceCount?: number;
  allowanceMessage?: string;
  /** Agent only — nudge to submit this month's allowance before it ends. */
  monthEndReminder?: boolean;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const totalCount =
    (followUpCount > 0 ? 1 : 0) + birthdays.length + (allowanceCount > 0 ? 1 : 0) + (monthEndReminder ? 1 : 0);
  const leadsHref = role === "admin" ? "/admin/leads?followup=today" : "/agent/leads?followup=today";
  const allowanceHref = role === "admin" ? "/admin/allowances?status=submitted" : "/agent/allowances";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        aria-label="Notifications"
      >
        <Bell className="h-4.5 w-4.5" />
        {totalCount > 0 && (
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-30 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-popover">
          {totalCount === 0 ? (
            <p className="px-2 py-3 text-center text-sm text-slate-500">You&apos;re all caught up.</p>
          ) : (
            <ul className="space-y-1">
              {followUpCount > 0 && (
                <li>
                  <Link
                    href={leadsHref}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-2 rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                    <span>
                      {followUpCount} lead{followUpCount === 1 ? "" : "s"} need follow-up today
                    </span>
                  </Link>
                </li>
              )}
              {birthdays.map((b) => (
                <li key={b.id} className="flex items-start gap-2 rounded-lg px-2 py-2 text-sm text-slate-700">
                  <Cake className="mt-0.5 h-4 w-4 shrink-0 text-accent-600" />
                  <span>It&apos;s {b.name}&apos;s birthday today! 🎂</span>
                </li>
              ))}
              {allowanceCount > 0 && (
                <li>
                  <Link
                    href={allowanceHref}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-2 rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <Receipt className="mt-0.5 h-4 w-4 shrink-0 text-warning-600" />
                    <span>{allowanceMessage}</span>
                  </Link>
                </li>
              )}
              {monthEndReminder && (
                <li>
                  <Link
                    href="/agent/allowances"
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-2 rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <Receipt className="mt-0.5 h-4 w-4 shrink-0 text-warning-600" />
                    <span>Month-end is coming up — submit this month&apos;s allowance.</span>
                  </Link>
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
