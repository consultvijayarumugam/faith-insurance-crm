import type { Tag } from "@/types";
import { accessibleBadgeTextColor, hexToRgba } from "@/lib/utils";

export function TagBadge({ tag, onRemove }: { tag: Tag; onRemove?: () => void }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: hexToRgba(tag.color, 0.12),
        color: accessibleBadgeTextColor(tag.color),
      }}
    >
      {tag.name}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${tag.name} tag`}
          className="-m-1.5 ml-0.5 rounded-full p-1.5 hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          ×
        </button>
      )}
    </span>
  );
}
