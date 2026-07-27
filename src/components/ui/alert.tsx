import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const VARIANT_STYLES = {
  error: {
    container: "border-rose-200 bg-rose-50 text-rose-700",
    icon: XCircle,
  },
  success: {
    container: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: CheckCircle2,
  },
  warning: {
    container: "border-amber-200 bg-amber-50 text-amber-800",
    icon: AlertTriangle,
  },
  info: {
    container: "border-slate-200 bg-slate-50 text-slate-700",
    icon: Info,
  },
} as const;

export function Alert({
  variant = "info",
  className,
  children,
}: {
  variant?: keyof typeof VARIANT_STYLES;
  className?: string;
  children: React.ReactNode;
}) {
  const { container, icon: Icon } = VARIANT_STYLES[variant];

  return (
    <div
      role={variant === "error" ? "alert" : undefined}
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm",
        container,
        className
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
