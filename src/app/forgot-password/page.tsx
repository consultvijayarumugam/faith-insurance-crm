import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthPageShell
      title="Reset your password"
      description="Enter your email and we'll send you a reset link."
    >
      <ForgotPasswordForm />
    </AuthPageShell>
  );
}
