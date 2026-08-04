"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ClosedCasesFilters({
  month,
  agents,
}: {
  month: string;
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
      <div className="w-44 space-y-1.5">
        <Label htmlFor="closed-month">Month</Label>
        <Input
          id="closed-month"
          type="month"
          value={month}
          onChange={(e) => updateParam("month", e.target.value)}
        />
      </div>
      <div className="w-48 space-y-1.5">
        <Label htmlFor="closed-agent">Agent</Label>
        <Select
          id="closed-agent"
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
