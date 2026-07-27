"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export interface BarDatum {
  key: string;
  label: string;
  value: number;
  displayValue: string;
  color: string;
  detail: string;
}

// label | track | value — shared across bars, gridlines, and axis ticks so
// everything lines up without pixel math.
const GRID_COLS = "8rem minmax(0,1fr) 3.5rem";

function niceTicks(max: number, count: number): number[] {
  if (max <= 0) return [0];
  const step = max / count;
  return Array.from({ length: count + 1 }, (_, i) => Math.round(step * i));
}

export function HorizontalBarChart({
  title,
  description,
  data,
  valueColumnLabel,
  maxValue,
  gridlineCount = 4,
  emptyMessage = "No data yet.",
}: {
  title: string;
  description?: string;
  data: BarDatum[];
  valueColumnLabel: string;
  maxValue?: number;
  gridlineCount?: number;
  emptyMessage?: string;
}) {
  const [hoveredKey, setHoveredKey] = React.useState<string | null>(null);
  const [showTable, setShowTable] = React.useState(false);

  const computedMax = Math.max(
    1,
    maxValue ?? Math.max(0, ...data.map((d) => d.value))
  );
  const ticks = niceTicks(computedMax, gridlineCount);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {data.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowTable((v) => !v)}
          >
            {showTable ? "View chart" : "View as table"}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            {emptyMessage}
          </p>
        ) : showTable ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-4">Label</th>
                <th className="py-2 pr-4">{valueColumnLabel}</th>
                <th className="py-2">Detail</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.key} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 pr-4 text-slate-700">{d.label}</td>
                  <td className="py-2 pr-4 font-medium tabular-nums text-slate-900">
                    {d.displayValue}
                  </td>
                  <td className="py-2 text-slate-500">{d.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div
            className="grid"
            style={{
              gridTemplateColumns: GRID_COLS,
              rowGap: "0.75rem",
              columnGap: "0.75rem",
            }}
          >
            {/* gridlines — one shared overlay spanning every bar row */}
            <div
              className="pointer-events-none relative"
              style={{ gridColumn: 2, gridRow: `1 / ${data.length + 1}` }}
            >
              {ticks.map((t) => (
                <div
                  key={t}
                  className="absolute inset-y-0 w-px bg-slate-200"
                  style={{ left: `${(t / computedMax) * 100}%` }}
                />
              ))}
            </div>

            {data.map((d, i) => {
              const pct = (d.value / computedMax) * 100;
              const isHovered = hoveredKey === d.key;
              return (
                <React.Fragment key={d.key}>
                  <div
                    className="relative flex items-center"
                    style={{ gridColumn: 1, gridRow: i + 1 }}
                  >
                    <span
                      className="truncate text-sm text-slate-600"
                      title={d.label}
                    >
                      {d.label}
                    </span>
                    {isHovered && (
                      <div
                        role="tooltip"
                        className="absolute -top-2 left-0 z-10 w-max max-w-[16rem] -translate-y-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-popover"
                      >
                        <p className="font-semibold text-slate-900">{d.label}</p>
                        <p className="text-slate-500">{d.detail}</p>
                      </div>
                    )}
                  </div>

                  <div
                    className="relative flex h-5 items-center"
                    style={{ gridColumn: 2, gridRow: i + 1 }}
                    onMouseEnter={() => setHoveredKey(d.key)}
                    onMouseLeave={() => setHoveredKey(null)}
                    onFocus={() => setHoveredKey(d.key)}
                    onBlur={() => setHoveredKey(null)}
                    tabIndex={0}
                    role="img"
                    aria-label={`${d.label}: ${d.displayValue}. ${d.detail}`}
                  >
                    <span
                      className="h-full rounded-r-[4px]"
                      style={{
                        width: `${Math.max(pct, 1.5)}%`,
                        backgroundColor: d.color,
                        filter: isHovered ? "brightness(0.92)" : undefined,
                      }}
                    />
                  </div>

                  <span
                    className="self-center text-right text-sm font-medium tabular-nums text-slate-900"
                    style={{ gridColumn: 3, gridRow: i + 1 }}
                  >
                    {d.displayValue}
                  </span>
                </React.Fragment>
              );
            })}

            <span style={{ gridColumn: 1, gridRow: data.length + 1 }} />
            <div
              className="relative h-4 border-t border-slate-100"
              style={{ gridColumn: 2, gridRow: data.length + 1 }}
            >
              {ticks.map((t) => (
                <span
                  key={t}
                  className="absolute top-1 -translate-x-1/2 text-[11px] tabular-nums text-slate-400"
                  style={{ left: `${(t / computedMax) * 100}%` }}
                >
                  {t}
                </span>
              ))}
            </div>
            <span style={{ gridColumn: 3, gridRow: data.length + 1 }} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
