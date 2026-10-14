"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { retentionSettingSchema } from "@/lib/validations/retention";
import type { RetentionSetting } from "@/types";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, error: "You must be signed in." } as const;

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    return { supabase, error: "Only admins can manage data retention." } as const;
  }

  return { supabase, error: null } as const;
}

export async function updateRetentionSetting(formData: FormData) {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const parsed = retentionSettingSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { error } = await supabase
    .from("app_settings")
    .update({ value: { years: parsed.data.years, dry_run: parsed.data.dry_run } })
    .eq("key", "retention");

  if (error) return { error: error.message };

  revalidatePath("/admin/settings");
  return {};
}

// Deliberately has no way to request a live run — p_dry_run is hardcoded
// true here, never taken from a parameter, so this action can never trigger
// a real delete no matter what a client sends it. EXECUTE on the function
// itself is also revoked from the authenticated role (0012), so this has to
// go through the service-role client — same "verify admin first, then use
// admin.ts" shape as every other privileged action in this app.
export async function runRetentionDryRun() {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const { data: settingRow } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "retention")
    .maybeSingle();
  const years = (settingRow?.value as Partial<RetentionSetting> | null)?.years ?? 3;

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("run_retention_cleanup", {
    p_years: years,
    p_dry_run: true,
    p_triggered_by: "manual",
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/settings");
  return { counts: data };
}
