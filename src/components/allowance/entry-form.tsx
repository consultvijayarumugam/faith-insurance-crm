"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { upsertEntry, resubmitEntry } from "@/lib/actions/allowance-entries";
import { useToast } from "@/components/ui/toast";
import { VEHICLE_TYPE_LABELS } from "@/lib/allowance";
import { formatCurrency } from "@/lib/format";
import type { AllowanceEntry, AllowanceRate, AllowanceVehicleType } from "@/types";

export function EntryForm({
  mode,
  entry,
  month,
  rates,
  onDone,
}: {
  mode: "add" | "resubmit";
  entry?: AllowanceEntry;
  month: string;
  rates: AllowanceRate[];
  onDone?: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [entryDate, setEntryDate] = React.useState(entry?.entry_date ?? "");
  const [vehicleType, setVehicleType] = React.useState<AllowanceVehicleType>(entry?.vehicle_type ?? "bike");
  const [km, setKm] = React.useState(entry?.km?.toString() ?? "");

  const previewAmount = React.useMemo(() => {
    const kmNum = Number(km);
    if (!kmNum || !entryDate) return null;
    const candidates = rates
      .filter((r) => r.vehicle_type === vehicleType && r.effective_from <= entryDate)
      .sort((a, b) => b.effective_from.localeCompare(a.effective_from));
    const rate = candidates[0];
    if (!rate) return null;
    return Math.round(kmNum * rate.rate_per_km * 100) / 100;
  }, [km, entryDate, vehicleType, rates]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const result =
      mode === "resubmit" && entry
        ? await resubmitEntry(entry.id, formData)
        : await upsertEntry(null, formData);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      toast({ title: "Couldn't save entry", description: result.error, variant: "error" });
      return;
    }
    toast({
      title: mode === "resubmit" ? "Entry resubmitted" : "Entry added",
      variant: "success",
    });
    router.refresh();
    onDone?.();
  }

  const [monthStart, monthEndExclusive] = React.useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const start = `${month}-01`;
    const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
    return [start, nextMonth];
  }, [month]);

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      {error && <Alert variant="error">{error}</Alert>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="entry_date">Date</Label>
          <Input
            id="entry_date"
            name="entry_date"
            type="date"
            required
            min={monthStart}
            max={new Date(new Date(monthEndExclusive).getTime() - 86400000).toISOString().slice(0, 10)}
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            readOnly={mode === "resubmit"}
            className={mode === "resubmit" ? "bg-slate-50 text-slate-500" : undefined}
          />
          {mode === "resubmit" && (
            <p className="text-xs text-slate-400">The date can&apos;t change when fixing a rejected entry.</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vehicle_type">Vehicle</Label>
          <Select
            id="vehicle_type"
            name="vehicle_type"
            value={vehicleType}
            onChange={(e) => setVehicleType(e.target.value as AllowanceVehicleType)}
          >
            {Object.entries(VEHICLE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="km">Distance (km)</Label>
          <Input
            id="km"
            name="km"
            type="number"
            step="0.1"
            min="0"
            required
            value={km}
            onChange={(e) => setKm(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="purpose">Purpose</Label>
        <Input id="purpose" name="purpose" required defaultValue={entry?.purpose} placeholder="e.g. Client visit — policy renewal" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea id="notes" name="notes" rows={2} defaultValue={entry?.notes ?? ""} />
      </div>

      {previewAmount !== null && (
        <p className="text-sm text-slate-500">
          Estimated travel amount: <span className="font-medium text-slate-900">{formatCurrency(previewAmount)}</span>
          {" "}— confirmed once saved.
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {mode === "resubmit" ? "Save & resubmit" : "Add entry"}
        </Button>
        {onDone && (
          <Button type="button" size="sm" variant="ghost" onClick={onDone} disabled={pending}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
