"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { runRetentionDryRun } from "@/lib/actions/retention";

export function RunRetentionNowButton() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [counts, setCounts] = React.useState<Record<string, number> | null>(null);

  async function handleRun() {
    setPending(true);
    setError(null);
    setCounts(null);
    const result = await runRetentionDryRun();
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setCounts((result?.counts as Record<string, number>) ?? {});
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <Button type="button" size="sm" variant="secondary" onClick={handleRun} disabled={pending}>
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
        Run now (dry run)
      </Button>
      {error && <Alert variant="error">{error}</Alert>}
      {counts && (
        <Alert variant="info">
          Would delete: {Object.entries(counts).map(([table, n]) => `${table}: ${n}`).join(" · ")}
        </Alert>
      )}
    </div>
  );
}
