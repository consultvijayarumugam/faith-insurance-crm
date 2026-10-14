"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PerformanceReportFilters({
  start,
  end,
  agents,
}: {
  start: string;
  end: string;
  agents: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const agent = searchParams.get("agent") ?? "";

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="w-40 space-y-1.5">
        <Label htmlFor="report-start">From</Label>
        <Input
          id="report-start"
          type="date"
          value={start}
          max={end}
          onChange={(e) => updateParam("start", e.target.value)}
        />
      </div>
      <div className="w-40 space-y-1.5">
        <Label htmlFor="report-end">To</Label>
        <Input
          id="report-end"
          type="date"
          value={end}
          min={start}
          onChange={(e) => updateParam("end", e.target.value)}
        />
      </div>
      <div className="w-48 space-y-1.5">
        <Label htmlFor="report-agent">Agent</Label>
        <Select
          id="report-agent"
          value={agent}
          onChange={(e) => updateParam("agent", e.target.value)}
        >
          <option value="">All agents</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
