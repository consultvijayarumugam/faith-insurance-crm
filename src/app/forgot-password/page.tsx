import { ShieldCheck } from "lucide-react";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-brand-700" />
            <span className="text-base font-semibold text-slate-900">
              Faith Insurance CRM
            </span>
          </span>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            Reset your password
          </h2>
          <p className="text-sm text-slate-500">
            Enter your email and we&apos;ll send you a reset link.
          </p>
        </div>
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
