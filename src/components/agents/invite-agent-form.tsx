"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { TempPasswordReveal } from "@/components/agents/temp-password-reveal";
import { inviteAgent } from "@/lib/actions/agents";
import type { TempPasswordResult } from "@/types";

export function InviteAgentForm() {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<TempPasswordResult | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const res = await inviteAgent(formData);

    setPending(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    setResult(res);
    formRef.current?.reset();
    router.refresh();
  }

  function handleDone() {
    setResult(null);
    setOpen(false);
  }

  if (result) {
    return (
      <Card>
        <CardContent>
          <TempPasswordReveal
            result={result}
            heading={`Agent account created for ${result.name}.`}
            onDone={handleDone}
          />
        </CardContent>
      </Card>
    );
  }

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)}>
        <UserPlus className="h-4 w-4" />
        Invite agent
      </Button>
    );
  }

  return (
    <Card>
      <form ref={formRef} onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && <Alert variant="error">{error}</Alert>}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="invite-name">Name</Label>
              <Input id="invite-name" name="name" required autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email</Label>
              <Input id="invite-email" name="email" type="email" required />
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {pending ? "Creating…" : "Create agent"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
              disabled={pending}
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </form>
    </Card>
  );
}
