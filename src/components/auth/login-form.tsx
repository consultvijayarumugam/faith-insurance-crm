"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { forgotPasswordSchema } from "@/lib/validations/auth";

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = React.useState<"login" | "forgot">("login");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [resetSent, setResetSent] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError("Incorrect email or password. Please try again.");
      setLoading(false);
      return;
    }

    // Middleware routes to /agent/dashboard or /admin/dashboard based on role.
    router.replace("/");
    router.refresh();
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid email");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      parsed.data.email,
      { redirectTo: `${window.location.origin}/reset-password` }
    );
    setLoading(false);

    // Supabase returns success regardless of whether the email matches an
    // account, so there's nothing account-specific to branch on here.
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setResetSent(true);
  }

  if (mode === "forgot") {
    return (
      <form onSubmit={handleForgotPassword} className="space-y-5" noValidate>
        {error && <Alert variant="error">{error}</Alert>}
        {resetSent ? (
          <Alert variant="success">
            If an account exists for {email}, a reset link has been sent.
          </Alert>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="forgot-email">Email</Label>
            <Input
              id="forgot-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@faithinsurance.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        )}

        {!resetSent && (
          <Button type="submit" variant="primary" size="lg" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Sending…" : "Send reset link"}
          </Button>
        )}

        <button
          type="button"
          onClick={() => {
            setMode("login");
            setError(null);
            setResetSent(false);
          }}
          className="w-full text-center text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          Back to sign in
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
        >
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@faithinsurance.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <button
            type="button"
            onClick={() => {
              setMode("forgot");
              setError(null);
            }}
            className="text-xs font-medium text-brand-700 hover:text-brand-800"
          >
            Forgot password?
          </button>
        </div>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
            aria-label={showPassword ? "Hide password" : "Show password"}
            tabIndex={-1}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={loading}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {loading ? "Signing in…" : "Sign in"}
      </Button>

      <p className="text-center text-xs text-slate-400">
        Don&apos;t have an account? Ask your admin to invite you.
      </p>
    </form>
  );
}
