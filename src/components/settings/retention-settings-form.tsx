"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { updateRetentionSetting } from "@/lib/actions/retention";
import type { RetentionSetting } from "@/types";

export function RetentionSettingsForm({ setting }: { setting: RetentionSetting }) {
  const router = useRouter();
  const [years, setYears] = React.useState(setting.years);
  const [dryRun, setDryRun] = React.useState(setting.dry_run);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);
    const result = await updateRetentionSetting(new FormData(e.currentTarget));
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-40 space-y-1.5">
          <Label htmlFor="years">Keep closed data for</Label>
          <Select
            id="years"
            name="years"
            value={years}
            onChange={(e) => setYears(Number(e.target.value) as RetentionSetting["years"])}
          >
            <option value={1}>1 year</option>
            <option value={2}>2 years</option>
            <option value={3}>3 years</option>
          </Select>
        </div>

        <label className="flex items-center gap-2 pb-2.5 text-sm text-slate-700">
          <input
            type="checkbox"
            name="dry_run"
            value="true"
            checked={dryRun}
            onChange={(e) => setDryRun(e.target.checked)}
          />
          Dry run (log what would be deleted, delete nothing)
        </label>
        {/* Pairs with the checkbox above so this field is always present in
            FormData — an unchecked checkbox submits nothing on its own. */}
        <input type="hidden" name="dry_run" value="false" />

        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Save
        </Button>
        {saved && !error && <span className="text-sm text-emerald-600">Saved.</span>}
      </div>
      {!dryRun && (
        <Alert variant="warning">
          Dry run is off — the next cron run will permanently delete eligible leads and
          attendance records.
        </Alert>
      )}
      {error && <Alert variant="error">{error}</Alert>}
    </form>
  );
}
