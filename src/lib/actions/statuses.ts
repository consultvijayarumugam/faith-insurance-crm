"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { leadStatusSchema } from "@/lib/validations/statuses";

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
    return { supabase, error: "Only admins can manage lead statuses." } as const;
  }

  return { supabase, error: null } as const;
}

export async function createLeadStatus(formData: FormData) {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const parsed = leadStatusSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { data: maxRow } = await supabase
    .from("lead_statuses")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSortOrder = (maxRow?.sort_order ?? 0) + 1;

  const { error } = await supabase.from("lead_statuses").insert({
    name: parsed.data.name,
    color: parsed.data.color,
    is_won: parsed.data.is_won,
    is_lost: parsed.data.is_lost,
    sort_order: nextSortOrder,
  });

  if (error) {
    const message = /unique/i.test(error.message)
      ? "A status with this name already exists."
      : error.message;
    return { error: message };
  }

  revalidatePath("/admin/statuses");
  revalidatePath("/admin/leads");
  revalidatePath("/agent/leads");
  return {};
}

export async function updateLeadStatus(statusId: string, formData: FormData) {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const parsed = leadStatusSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { error } = await supabase
    .from("lead_statuses")
    .update({
      name: parsed.data.name,
      color: parsed.data.color,
      is_won: parsed.data.is_won,
      is_lost: parsed.data.is_lost,
    })
    .eq("id", statusId);

  if (error) {
    const message = /unique/i.test(error.message)
      ? "A status with this name already exists."
      : error.message;
    return { error: message };
  }

  revalidatePath("/admin/statuses");
  revalidatePath("/admin/leads");
  revalidatePath("/agent/leads");
  revalidatePath("/admin/dashboard");
  return {};
}

export async function reorderLeadStatus(statusId: string, direction: "up" | "down") {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const { data: statuses } = await supabase
    .from("lead_statuses")
    .select("id, sort_order")
    .order("sort_order");
  if (!statuses) return { error: "Could not load statuses." };

  const index = statuses.findIndex((s) => s.id === statusId);
  if (index === -1) return { error: "Status not found." };

  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= statuses.length) return {};

  const current = statuses[index];
  const swapWith = statuses[swapIndex];

  const [{ error: err1 }, { error: err2 }] = await Promise.all([
    supabase.from("lead_statuses").update({ sort_order: swapWith.sort_order }).eq("id", current.id),
    supabase.from("lead_statuses").update({ sort_order: current.sort_order }).eq("id", swapWith.id),
  ]);
  if (err1 || err2) return { error: (err1 ?? err2)?.message ?? "Reorder failed." };

  revalidatePath("/admin/statuses");
  revalidatePath("/admin/leads");
  revalidatePath("/agent/leads");
  revalidatePath("/admin/dashboard");
  return {};
}

export async function deleteLeadStatus(statusId: string) {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const { error } = await supabase.from("lead_statuses").delete().eq("id", statusId);

  if (error) {
    // Postgres foreign_key_violation — this status is still assigned to
    // one or more leads (leads.status_id is `on delete restrict`).
    const message =
      error.code === "23503"
        ? "This status is still assigned to one or more leads. Reassign them first."
        : error.message;
    return { error: message };
  }

  revalidatePath("/admin/statuses");
  revalidatePath("/admin/leads");
  revalidatePath("/agent/leads");
  revalidatePath("/admin/dashboard");
  return {};
}
