import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export interface VerticalBarDatum {
  key: string;
  label: string;
  value: number;
}

const BAR_COLOR = "#2563eb";

export function VerticalBarChart({
  title,
  description,
  data,
  emptyMessage = "No data yet.",
}: {
  title: string;
  description?: string;
  data: VerticalBarDatum[];
  emptyMessage?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        {data.every((d) => d.value === 0) ? (
          <p className="py-6 text-center text-sm text-slate-500">{emptyMessage}</p>
        ) : (
          <div className="flex items-end gap-4" style={{ height: "9rem" }}>
            {data.map((d) => (
              <div key={d.key} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="text-xs font-medium tabular-nums text-slate-700">{d.value}</span>
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t-[4px]"
                    style={{
                      height: `${Math.max((d.value / max) * 100, d.value > 0 ? 4 : 0)}%`,
                      backgroundColor: BAR_COLOR,
                    }}
                  />
                </div>
                <span className="text-center text-[11px] leading-tight text-slate-500">
                  {d.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
