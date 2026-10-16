import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const VARIANT_STYLES = {
  error: {
    container: "border-danger-200 bg-danger-50 text-danger-700",
    icon: XCircle,
  },
  success: {
    container: "border-success-200 bg-success-50 text-success-700",
    icon: CheckCircle2,
  },
  warning: {
    container: "border-warning-200 bg-warning-50 text-warning-800",
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
        "flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm animate-fade-in motion-reduce:animate-none",
        container,
        className
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
