"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { X, CalendarClock } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { accessibleBadgeBackgroundColor, cn } from "@/lib/utils";
import type { LeadFieldDefinition, LeadStatusOption, Tag } from "@/types";

export function LeadsFilters({
  products,
  agents,
  statuses,
  selectFields,
  tags,
}: {
  products: string[];
  agents?: { id: string; name: string }[];
  statuses: LeadStatusOption[];
  /** Admin-defined dropdown-type custom fields, filterable one at a time. */
  selectFields?: LeadFieldDefinition[];
  tags?: Tag[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const agent = searchParams.get("agent") ?? "";
  const status = searchParams.get("status") ?? "";
  const product = searchParams.get("product") ?? "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const followup = searchParams.get("followup") ?? "";
  const cf = searchParams.get("cf") ?? "";
  const cfv = searchParams.get("cfv") ?? "";
  const tag = searchParams.get("tag") ?? "";

  const hasFilters = Boolean(agent || status || product || from || to || followup || cf || tag);
  const activeField = (selectFields ?? []).find((f) => f.id === cf);

  function updateCustomField(fieldId: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (fieldId) {
      params.set("cf", fieldId);
    } else {
      params.delete("cf");
    }
    params.delete("cfv");
    router.push(`${pathname}?${params.toString()}`);
  }

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
    <div className="space-y-4">
      {/* Status tabs — the pipeline is admin-editable data, not a fixed
          list, so this reads from the live `statuses` prop rather than a
          hardcoded set. */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        <button
          type="button"
          onClick={() => updateParam("status", "")}
          className={cn(
            "flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
            status === ""
              ? "border-brand-600 bg-brand-600 text-white"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          )}
        >
          All
        </button>
        {statuses.map((s) => {
          const active = status === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => updateParam("status", active ? "" : s.id)}
              className={cn(
                "flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
                active ? "border-transparent text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              )}
              style={active ? { backgroundColor: accessibleBadgeBackgroundColor(s.color) } : undefined}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: active ? "white" : s.color }}
              />
              {s.name}
            </button>
          );
        })}
      </div>

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

        {selectFields && selectFields.length > 0 && (
          <>
            <div className="w-44 space-y-1.5">
              <Label htmlFor="filter-cf">Custom field</Label>
              <Select
                id="filter-cf"
                value={cf}
                onChange={(e) => updateCustomField(e.target.value)}
              >
                <option value="">None</option>
                {selectFields.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </Select>
            </div>
            {activeField && (
              <div className="w-44 space-y-1.5">
                <Label htmlFor="filter-cfv">{activeField.name}</Label>
                <Select
                  id="filter-cfv"
                  value={cfv}
                  onChange={(e) => updateParam("cfv", e.target.value)}
                >
                  <option value="">Any value</option>
                  {(activeField.options ?? []).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </>
        )}

        {tags && tags.length > 0 && (
          <div className="w-44 space-y-1.5">
            <Label htmlFor="filter-tag">Tag</Label>
            <Select id="filter-tag" value={tag} onChange={(e) => updateParam("tag", e.target.value)}>
              <option value="">All tags</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
        )}

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

        <Button
          type="button"
          variant={followup === "today" ? "primary" : "secondary"}
          size="sm"
          onClick={() => updateParam("followup", followup === "today" ? "" : "today")}
        >
          <CalendarClock className="h-3.5 w-3.5" />
          Due today
        </Button>

        {hasFilters && (
          <Button type="button" variant="ghost" size="sm" onClick={() => router.push(pathname)}>
            <X className="h-3.5 w-3.5" />
            Clear filters
          </Button>
        )}
      </div>
    </div>
  );
}
