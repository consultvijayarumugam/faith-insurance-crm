import { Suspense } from "react";
import { ShieldCheck, TrendingUp, Users } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-900 via-brand-800 to-accent-800 p-12 text-white md:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, white 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        <div className="relative flex items-center gap-2">
          <ShieldCheck className="h-7 w-7" />
          <span className="text-lg font-semibold tracking-tight">
            Faith Insurance CRM
          </span>
        </div>

        <div className="relative space-y-8">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-balance">
            Every lead, every quote, every renewal — in one place.
          </h1>
          <ul className="space-y-4 text-sm text-brand-100">
            <li className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10">
                <Users className="h-4 w-4" />
              </span>
              Give agents a focused view of only their own pipeline.
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10">
                <TrendingUp className="h-4 w-4" />
              </span>
              Track conversion and pipeline value across the whole team.
            </li>
          </ul>
        </div>

        <p className="relative text-xs text-brand-200">
          © {new Date().getFullYear()} Faith Insurance. Internal use only.
        </p>
      </div>

      {/* Form panel */}
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
              Welcome back
            </h2>
            <p className="text-sm text-slate-500">
              Sign in with the email and password your admin gave you.
            </p>
          </div>
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
