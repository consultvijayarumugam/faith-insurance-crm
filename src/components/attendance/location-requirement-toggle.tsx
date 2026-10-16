"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { updateAttendanceLocationSetting } from "@/lib/actions/settings";

export function LocationRequirementToggle({ requireLocation }: { requireLocation: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [checked, setChecked] = React.useState(requireLocation);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await updateAttendanceLocationSetting(new FormData(e.currentTarget));
    setPending(false);
    if (result?.error) {
      setError(result.error);
      toast({ title: "Couldn't save setting", description: result.error, variant: "error" });
      return;
    }
    toast({ title: "Setting saved", variant: "success" });
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="require_location_for_punch"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
        />
        Require location to punch in/out
      </label>
      <Button type="submit" size="sm" className="min-h-11" variant="secondary" disabled={pending}>
        {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        Save
      </Button>
      {error && <Alert variant="error">{error}</Alert>}
    </form>
  );
}
