import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { RetentionSettingsForm } from "@/components/settings/retention-settings-form";
import { RunRetentionNowButton } from "@/components/settings/run-retention-now-button";
import { RetentionLogTable } from "@/components/settings/retention-log-table";
import type { RetentionLog, RetentionSetting } from "@/types";

export default async function AdminSettingsPage() {
  const supabase = await createClient();

  const [{ data: settingRow }, { data: logsData }] = await Promise.all([
    supabase.from("app_settings").select("value").eq("key", "retention").maybeSingle(),
    supabase.from("retention_log").select("id, run_at, mode, triggered_by, counts").order("run_at", { ascending: false }).limit(10),
  ]);

  const setting: RetentionSetting = {
    years: ((settingRow?.value as Partial<RetentionSetting> | null)?.years ?? 3) as RetentionSetting["years"],
    dry_run: (settingRow?.value as Partial<RetentionSetting> | null)?.dry_run ?? true,
  };
  const logs = (logsData ?? []) as RetentionLog[];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">Settings</h2>
        <p className="mt-1 text-sm text-slate-500">Admin-only app configuration.</p>
      </div>

      <Card>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Data Retention</h3>
            <p className="mt-1 text-sm text-slate-500">
              Closed or lost leads (and their notes, call logs, follow-ups, and tags) and
              attendance records older than the cutoff are eligible for cleanup. Leads with a
              pending follow-up, attendance days with a pending correction, or anything with
              activity inside the cutoff are never touched.
            </p>
          </div>

          <RetentionSettingsForm setting={setting} />

          <div className="border-t border-slate-100 pt-4">
            <RunRetentionNowButton />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">Recent Runs</h3>
          <RetentionLogTable logs={logs} />
        </CardContent>
      </Card>
    </div>
  );
}
