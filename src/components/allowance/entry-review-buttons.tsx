"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { approveEntry, rejectEntry } from "@/lib/actions/allowance-review";

export function EntryReviewButtons({ entryId }: { entryId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [rejecting, setRejecting] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [missingRate, setMissingRate] = React.useState(false);

  async function handleApprove() {
    setPending(true);
    setError(null);
    setMissingRate(false);
    const result = await approveEntry(entryId);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      setMissingRate(!!result.missingRate);
      toast({ title: "Couldn't approve", description: result.error, variant: "error" });
      return;
    }
    toast({ title: "Entry approved", variant: "success" });
    router.refresh();
  }

  async function handleReject() {
    if (!reason.trim()) return;
    setPending(true);
    setError(null);
    setMissingRate(false);
    const formData = new FormData();
    formData.set("reason", reason);
    const result = await rejectEntry(entryId, formData);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      setMissingRate(!!result.missingRate);
      toast({ title: "Couldn't reject", description: result.error, variant: "error" });
      return;
    }
    toast({ title: "Entry rejected", variant: "success" });
    setRejecting(false);
    setReason("");
    router.refresh();
  }

  const errorAlert = error && (
    <Alert variant="error">
      <p>{error}</p>
      {missingRate && (
        <Link href="/admin/allowances/settings" className="mt-1 inline-block font-medium underline">
          Go to Allowance Settings
        </Link>
      )}
    </Alert>
  );

  if (rejecting) {
    return (
      <div className="w-full space-y-2 rounded-lg bg-slate-50 p-3">
        {errorAlert}
        <Textarea
          placeholder="Reason for rejecting this line..."
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="destructive" onClick={handleReject} disabled={pending || !reason.trim()}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Confirm reject"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setRejecting(false)} disabled={pending}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-2">
      {errorAlert}
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={handleApprove} disabled={pending}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 text-success-600" />}
          Approve
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setRejecting(true)} disabled={pending}>
          <X className="h-3.5 w-3.5 text-danger-500" />
          Reject
        </Button>
      </div>
    </div>
  );
}
