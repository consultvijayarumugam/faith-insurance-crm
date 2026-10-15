import { accessibleBadgeTextColor, hexToRgba } from "@/lib/utils";

export function LeadStatusBadge({ status }: { status: { name: string; color: string } }) {
  return (
    <span
      className="inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium"
      style={{
        backgroundColor: hexToRgba(status.color, 0.14),
        color: accessibleBadgeTextColor(status.color),
      }}
    >
      {status.name}
    </span>
  );
}
