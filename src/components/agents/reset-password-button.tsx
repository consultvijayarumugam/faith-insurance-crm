"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { TempPasswordReveal } from "@/components/agents/temp-password-reveal";
import { resetAgentPassword } from "@/lib/actions/agents";
import type { TempPasswordResult } from "@/types";

export function ResetPasswordButton({
  agentId,
  agentName,
}: {
  agentId: string;
  agentName: string;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<TempPasswordResult | null>(null);

  async function handleReset() {
    if (
      !confirm(
        `Reset ${agentName}'s password? They'll need the new temporary password to sign in.`
      )
    ) {
      return;
    }
    setPending(true);
    setError(null);
    const res = await resetAgentPassword(agentId);
    setPending(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setResult(res);
    router.refresh();
  }

  if (result) {
    return (
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 text-left shadow-popover">
        <TempPasswordReveal
          result={result}
          heading={`Password reset for ${result.name}.`}
          onDone={() => setResult(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {error && <Alert variant="error">{error}</Alert>}
      <Button type="button" size="sm" variant="ghost" onClick={handleReset} disabled={pending}>
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <KeyRound className="h-3.5 w-3.5" />
        )}
        Reset password
      </Button>
    </div>
  );
}
