"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { addAllowanceRate, deleteAllowanceRate } from "@/lib/actions/allowance-settings";
import { formatCurrency, formatDate } from "@/lib/format";
import { VEHICLE_TYPE_LABELS } from "@/lib/allowance";
import type { AllowanceRate } from "@/types";

export function RateForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await addAllowanceRate(new FormData(e.currentTarget));
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    toast({ title: "Rate added", variant: "success" });
    (e.target as HTMLFormElement).reset();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      {error && <Alert variant="error" className="w-full">{error}</Alert>}
      <div className="w-36 space-y-1.5">
        <Label htmlFor="vehicle_type">Vehicle</Label>
        <Select id="vehicle_type" name="vehicle_type" defaultValue="bike">
          {Object.entries(VEHICLE_TYPE_LABELS).map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </Select>
      </div>
      <div className="w-32 space-y-1.5">
        <Label htmlFor="rate_per_km">Rate / km</Label>
        <Input id="rate_per_km" name="rate_per_km" type="number" step="0.01" min="0" required />
      </div>
      <div className="w-40 space-y-1.5">
        <Label htmlFor="effective_from">Effective from</Label>
        <Input id="effective_from" name="effective_from" type="date" required />
      </div>
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        Add rate
      </Button>
    </form>
  );
}

export function RateHistoryTable({ rates }: { rates: AllowanceRate[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const { toast } = useToast();
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  async function handleDelete(rate: AllowanceRate) {
    const ok = await confirm({
      title: `Delete this rate?`,
      description: `${VEHICLE_TYPE_LABELS[rate.vehicle_type]} — ${formatCurrency(rate.rate_per_km)}/km from ${formatDate(rate.effective_from)}`,
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    setPendingId(rate.id);
    const result = await deleteAllowanceRate(rate.id);
    setPendingId(null);
    if (result?.error) {
      toast({ title: "Couldn't delete rate", description: result.error, variant: "error" });
      return;
    }
    toast({ title: "Rate deleted", variant: "success" });
    router.refresh();
  }

  if (rates.length === 0) {
    return <p className="text-sm text-slate-500">No rates configured yet.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
          <th className="py-2 pr-4">Vehicle</th>
          <th className="py-2 pr-4">Rate / km</th>
          <th className="py-2 pr-4">Effective from</th>
          <th className="py-2" />
        </tr>
      </thead>
      <tbody>
        {rates.map((r) => (
          <tr key={r.id} className="border-b border-slate-100 last:border-0">
            <td className="py-2 pr-4 text-slate-700">{VEHICLE_TYPE_LABELS[r.vehicle_type]}</td>
            <td className="py-2 pr-4 tabular-nums text-slate-700">{formatCurrency(r.rate_per_km)}</td>
            <td className="py-2 pr-4 text-slate-700">{formatDate(r.effective_from)}</td>
            <td className="py-2 text-right">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => handleDelete(r)}
                disabled={pendingId === r.id}
              >
                {pendingId === r.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5 text-danger-600" />
                )}
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
