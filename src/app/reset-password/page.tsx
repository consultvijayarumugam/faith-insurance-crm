import { ShieldCheck } from "lucide-react";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default function ResetPasswordPage() {
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
            Set a new password
          </h2>
          <p className="text-sm text-slate-500">
            Choose a new password for your account.
          </p>
        </div>
        <ResetPasswordForm />
      </div>
    </div>
  );
}
