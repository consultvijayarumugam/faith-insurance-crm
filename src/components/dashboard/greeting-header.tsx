"use client";

import * as React from "react";
import { dailyMotivationalLine, greetingLine } from "@/lib/greetings";

export function GreetingHeader({ name }: { name: string }) {
  // Local time (greeting) and "today" (motivational line pick) both depend
  // on the viewer's own clock/time zone, which the server can't know — so
  // this renders a stable fallback first and swaps in the real line after
  // mount, rather than risking a server/client hydration mismatch.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const greeting = mounted ? greetingLine(name) : `Welcome back, ${name.trim().split(/\s+/)[0] || name}`;
  const line = mounted ? dailyMotivationalLine() : "";

  return (
    <div>
      <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
        {greeting}
      </h2>
      <p className="mt-1 min-h-[1.25rem] text-sm text-slate-500">{line}</p>
    </div>
  );
}
