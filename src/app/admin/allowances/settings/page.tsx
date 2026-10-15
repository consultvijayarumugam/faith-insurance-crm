import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { RateForm, RateHistoryTable } from "@/components/allowance/rate-form";
import { AllowanceSettingsForm } from "@/components/allowance/settings-form";
import type { AllowanceRate, AllowanceSettings } from "@/types";

export default async function AllowanceSettingsPage() {
  const supabase = await createClient();

  const [{ data: rates }, { data: settingRow }] = await Promise.all([
    supabase.from("allowance_rates").select("*").order("vehicle_type").order("effective_from", { ascending: false }),
    supabase.from("app_settings").select("value").eq("key", "allowance").maybeSingle(),
  ]);

  const settings = settingRow?.value as unknown as AllowanceSettings | undefined;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/allowances" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to claims
        </Link>
        <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-900">Allowance Settings</h2>
      </div>

      <Card>
        <CardContent className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">Rates</h3>
          <RateForm />
          <RateHistoryTable rates={(rates ?? []) as AllowanceRate[]} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">Caps & Categories</h3>
          {settings ? (
            <AllowanceSettingsForm settings={settings} />
          ) : (
            <p className="text-sm text-slate-500">Settings not found — re-run the allowance migration.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
