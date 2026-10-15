"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { markClaimPaid, reopenClaim } from "@/lib/actions/allowance-review";

export function MarkPaidForm({ claimId }: { claimId: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const ok = await confirm({ title: "Mark this claim as paid?", confirmLabel: "Mark paid" });
    if (!ok) return;
    setPending(true);
    setError(null);
    const result = await markClaimPaid(claimId, new FormData(e.currentTarget));
    setPending(false);
    if (result?.error) {
      setError(result.error);
      toast({ title: "Couldn't mark paid", description: result.error, variant: "error" });
      return;
    }
    toast({ title: "Claim marked paid", variant: "success" });
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        Mark as paid
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      {error && <Alert variant="error">{error}</Alert>}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-44 space-y-1.5">
          <Label htmlFor="paid_at">Payment date</Label>
          <Input id="paid_at" name="paid_at" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
        </div>
        <div className="w-56 space-y-1.5">
          <Label htmlFor="payment_reference">Reference</Label>
          <Input id="payment_reference" name="payment_reference" required placeholder="e.g. NEFT UTR number" />
        </div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Confirm
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function ReopenClaimForm({ claimId }: { claimId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [missingRate, setMissingRate] = React.useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setMissingRate(false);
    const result = await reopenClaim(claimId, new FormData(e.currentTarget));
    setPending(false);
    if (result?.error) {
      setError(result.error);
      setMissingRate(!!result.missingRate);
      toast({ title: "Couldn't reopen claim", description: result.error, variant: "error" });
      return;
    }
    toast({ title: "Claim reopened", variant: "success" });
    setOpen(false);
    setReason("");
    router.refresh();
  }

  if (!open) {
    return (
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        Reopen
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      {error && (
        <Alert variant="error">
          <p>{error}</p>
          {missingRate && (
            <Link href="/admin/allowances/settings" className="mt-1 inline-block font-medium underline">
              Go to Allowance Settings
            </Link>
          )}
        </Alert>
      )}
      <Label htmlFor="reopen_reason">Reason for reopening</Label>
      <Textarea
        id="reopen_reason"
        name="reason"
        rows={2}
        required
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="destructive" disabled={pending || !reason.trim()}>
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Confirm reopen
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
