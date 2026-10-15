"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { submitMonth } from "@/lib/actions/allowance-entries";
import { formatMonthLabel } from "@/lib/format";

export function SubmitMonthButton({ month }: { month: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const { toast } = useToast();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit() {
    const ok = await confirm({
      title: `Submit ${formatMonthLabel(month)} for review?`,
      description: "Entries lock once submitted — a rejected line can still be fixed and resubmitted.",
      confirmLabel: "Submit month",
    });
    if (!ok) return;
    setPending(true);
    setError(null);
    const result = await submitMonth(month);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      toast({ title: "Couldn't submit", description: result.error, variant: "error" });
      return;
    }
    toast({ title: "Month submitted for review", variant: "success" });
    router.refresh();
  }

  return (
    <div className="space-y-2">
      {error && <Alert variant="error">{error}</Alert>}
      <Button type="button" onClick={handleSubmit} disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Submit month
      </Button>
    </div>
  );
}
