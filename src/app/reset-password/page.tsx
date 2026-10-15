import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <AuthPageShell
      title="Set a new password"
      description="Choose a new password for your account."
    >
      <ResetPasswordForm />
    </AuthPageShell>
  );
}
