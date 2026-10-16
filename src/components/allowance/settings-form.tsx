"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { updateAllowanceSettings } from "@/lib/actions/allowance-settings";
import type { AllowanceSettings } from "@/types";

export function AllowanceSettingsForm({ settings }: { settings: AllowanceSettings }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await updateAllowanceSettings(new FormData(e.currentTarget));
    setPending(false);
    if (result?.error) {
      setError(result.error);
      toast({ title: "Couldn't save settings", description: result.error, variant: "error" });
      return;
    }
    toast({ title: "Settings saved", variant: "success" });
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <Alert variant="error">{error}</Alert>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="daily_km_cap">Daily km cap</Label>
          <Input
            id="daily_km_cap"
            name="daily_km_cap"
            type="number"
            min="0"
            defaultValue={settings.daily_km_cap}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="monthly_amount_cap">Monthly amount cap (₹)</Label>
          <Input
            id="monthly_amount_cap"
            name="monthly_amount_cap"
            type="number"
            min="0"
            defaultValue={settings.monthly_amount_cap}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="receipt_required_above_amount">Receipt required above (₹)</Label>
          <Input
            id="receipt_required_above_amount"
            name="receipt_required_above_amount"
            type="number"
            min="0"
            defaultValue={settings.receipt_required_above_amount}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="expense_categories">Expense categories (one per line)</Label>
        <Textarea
          id="expense_categories"
          name="expense_categories"
          rows={6}
          defaultValue={settings.expense_categories.join("\n")}
        />
      </div>
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        Save settings
      </Button>
    </form>
  );
}
