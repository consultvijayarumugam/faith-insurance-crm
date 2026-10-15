import { ShieldCheck } from "lucide-react";
import { AuthBrandPanel } from "@/components/auth/auth-brand-panel";

/** Shared two-column layout for every signed-out auth screen — brand panel
 * on desktop, a centered form card with a mobile-only logo on every width. */
export function AuthPageShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-2">
      <AuthBrandPanel />

      <div className="flex items-center justify-center bg-slate-50 px-6 py-12">
        <div className="w-full max-w-sm animate-fade-in">
          <div className="mb-8 flex flex-col items-center gap-2 text-center md:items-start md:text-left">
            <span className="flex items-center gap-2 md:hidden">
              <ShieldCheck className="h-6 w-6 text-brand-700" />
              <span className="text-base font-semibold text-slate-900">
                Faith Insurance CRM
              </span>
            </span>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
              {title}
            </h2>
            <p className="text-sm text-slate-500">{description}</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
