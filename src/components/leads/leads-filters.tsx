"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { X } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { LEAD_STATUSES } from "@/types";

export function LeadsFilters({
  products,
  agents,
}: {
  products: string[];
  agents?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const agent = searchParams.get("agent") ?? "";
  const status = searchParams.get("status") ?? "";
  const product = searchParams.get("product") ?? "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  const hasFilters = Boolean(agent || status || product || from || to);

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
      {agents && (
        <div className="w-48 space-y-1.5">
          <Label htmlFor="filter-agent">Agent</Label>
          <Select
            id="filter-agent"
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
      )}

      <div className="w-40 space-y-1.5">
        <Label htmlFor="filter-status">Status</Label>
        <Select
          id="filter-status"
          value={status}
          onChange={(e) => updateParam("status", e.target.value)}
        >
          <option value="">All statuses</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </div>

      <div className="w-48 space-y-1.5">
        <Label htmlFor="filter-product">Product</Label>
        <Select
          id="filter-product"
          value={product}
          onChange={(e) => updateParam("product", e.target.value)}
        >
          <option value="">All products</option>
          {products.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>
      </div>

      <div className="w-40 space-y-1.5">
        <Label htmlFor="filter-from">From</Label>
        <Input
          id="filter-from"
          type="date"
          value={from}
          max={to || undefined}
          onChange={(e) => updateParam("from", e.target.value)}
        />
      </div>

      <div className="w-40 space-y-1.5">
        <Label htmlFor="filter-to">To</Label>
        <Input
          id="filter-to"
          type="date"
          value={to}
          min={from || undefined}
          onChange={(e) => updateParam("to", e.target.value)}
        />
      </div>

      {hasFilters && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => router.push(pathname)}
        >
          <X className="h-3.5 w-3.5" />
          Clear filters
        </Button>
      )}
    </div>
  );
}
