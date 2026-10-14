"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { performanceThresholdSchema, attendanceLocationSettingSchema } from "@/lib/validations/settings";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, error: "You must be signed in." } as const;

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return { supabase, error: "Only admins can change app settings." } as const;
  }

  return { supabase, error: null } as const;
}

export async function updatePerformanceThreshold(formData: FormData) {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const parsed = performanceThresholdSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { error } = await supabase
    .from("app_settings")
    .update({ value: { min_calls_per_week: parsed.data.min_calls_per_week } })
    .eq("key", "performance_threshold");

  if (error) return { error: error.message };

  revalidatePath("/admin/reports/performance");
  return {};
}

export async function updateAttendanceLocationSetting(formData: FormData) {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const parsed = attendanceLocationSettingSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { error } = await supabase
    .from("app_settings")
    .update({ value: { require_location_for_punch: parsed.data.require_location_for_punch } })
    .eq("key", "attendance_location");

  if (error) return { error: error.message };

  revalidatePath("/admin/attendance");
  return {};
}
