"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { allowanceRateSchema, allowanceSettingsSchema } from "@/lib/validations/allowance";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, error: "You must be signed in." } as const;

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    return { supabase, error: "Only admins can change allowance settings." } as const;
  }

  return { supabase, error: null } as const;
}

export async function addAllowanceRate(formData: FormData) {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const parsed = allowanceRateSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { error } = await supabase.from("allowance_rates").insert(parsed.data);
  if (error) {
    if (error.code === "23505") {
      return { error: "A rate for this vehicle type already starts on this date." };
    }
    return { error: error.message };
  }

  revalidatePath("/admin/allowances/settings");
  return {};
}

export async function deleteAllowanceRate(rateId: string) {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const { error } = await supabase.from("allowance_rates").delete().eq("id", rateId);
  if (error) {
    // Entries reference a rate only indirectly (the amount is copied at
    // write time, not FK'd), so deletion never fails on that account —
    // this catches any other unexpected DB error instead.
    return { error: error.message };
  }

  revalidatePath("/admin/allowances/settings");
  return {};
}

export async function updateAllowanceSettings(formData: FormData) {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const parsed = allowanceSettingsSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { error } = await supabase
    .from("app_settings")
    .update({
      value: {
        daily_km_cap: parsed.data.daily_km_cap,
        monthly_amount_cap: parsed.data.monthly_amount_cap,
        expense_categories: parsed.data.expense_categories,
        receipt_required_above_amount: parsed.data.receipt_required_above_amount,
      },
    })
    .eq("key", "allowance");
  if (error) return { error: error.message };

  revalidatePath("/admin/allowances/settings");
  revalidatePath("/agent/allowances");
  return {};
}
