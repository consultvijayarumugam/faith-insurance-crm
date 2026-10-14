import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { RetentionSetting } from "@/types";

// Vercel Cron attaches `Authorization: Bearer $CRON_SECRET` automatically
// when CRON_SECRET is set as a project env var — this is the only thing
// standing in for auth here, since a cron invocation has no Supabase user
// session at all. The actual delete-or-not decision and the service-role-
// only enforcement live in run_retention_cleanup() itself (0012).
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: settingRow, error: settingError } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", "retention")
    .maybeSingle();
  if (settingError) {
    return NextResponse.json({ error: settingError.message }, { status: 500 });
  }

  const setting = settingRow?.value as Partial<RetentionSetting> | null;
  const years = setting?.years ?? 3;
  const dryRun = setting?.dry_run ?? true;

  const { data, error } = await admin.rpc("run_retention_cleanup", {
    p_years: years,
    p_dry_run: dryRun,
    p_triggered_by: "cron",
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ mode: dryRun ? "dry_run" : "live", counts: data });
}
