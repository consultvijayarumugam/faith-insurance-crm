"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { updatePerformanceThreshold } from "@/lib/actions/settings";

export function ThresholdForm({ minCallsPerWeek }: { minCallsPerWeek: number }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);
    const result = await updatePerformanceThreshold(new FormData(e.currentTarget));
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div className="w-48 space-y-1.5">
        <Label htmlFor="min_calls_per_week">Target calls / week / agent</Label>
        <Input
          id="min_calls_per_week"
          name="min_calls_per_week"
          type="number"
          min="0"
          step="1"
          defaultValue={minCallsPerWeek}
        />
      </div>
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        Save
      </Button>
      {saved && !error && <span className="text-sm text-emerald-600">Saved.</span>}
      {error && <Alert variant="error">{error}</Alert>}
    </form>
  );
}
