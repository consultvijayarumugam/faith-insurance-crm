"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Loader2, Copy, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { inviteAgent, type InviteAgentResult } from "@/lib/actions/agents";

export function InviteAgentForm() {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<InviteAgentResult | null>(null);
  const [copied, setCopied] = React.useState(false);

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
    setCopied(false);
  }

  async function handleCopy() {
    if (!result) return;
    await navigator.clipboard.writeText(
      `Email: ${result.email}\nTemporary password: ${result.tempPassword}`
    );
    setCopied(true);
  }

  if (result) {
    return (
      <Card>
        <CardContent className="space-y-4">
          <Alert variant="success">
            Agent account created for {result.name}.
          </Alert>

          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
            <p>
              <span className="text-slate-500">Email: </span>
              <span className="font-medium text-slate-900">{result.email}</span>
            </p>
            <p>
              <span className="text-slate-500">Temporary password: </span>
              <span className="font-mono font-medium text-slate-900">
                {result.tempPassword}
              </span>
            </p>
          </div>

          <Alert variant="warning">
            This password won&apos;t be shown again. Share it with{" "}
            {result.name} securely — they can sign in with it right away.
          </Alert>

          <div className="flex gap-2">
            <Button type="button" onClick={handleCopy}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy credentials"}
            </Button>
            <Button type="button" variant="ghost" onClick={handleDone}>
              Done
            </Button>
          </div>
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
