"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { dispositionSchema } from "@/lib/validations/dispositions";

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
    return { supabase, error: "Only admins can manage call dispositions." } as const;
  }

  return { supabase, error: null } as const;
}

function revalidateDispositionPaths() {
  revalidatePath("/admin/dispositions");
  revalidatePath("/admin/leads");
  revalidatePath("/agent/leads");
}

export async function createDisposition(formData: FormData) {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const parsed = dispositionSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { data: maxRow } = await supabase
    .from("call_dispositions")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSortOrder = (maxRow?.sort_order ?? 0) + 1;

  const { error } = await supabase.from("call_dispositions").insert({
    name: parsed.data.name,
    sort_order: nextSortOrder,
  });

  if (error) {
    const message = /unique/i.test(error.message)
      ? "A disposition with this name already exists."
      : error.message;
    return { error: message };
  }

  revalidateDispositionPaths();
  return {};
}

export async function updateDisposition(dispositionId: string, formData: FormData) {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const parsed = dispositionSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { error } = await supabase
    .from("call_dispositions")
    .update({ name: parsed.data.name })
    .eq("id", dispositionId);

  if (error) {
    const message = /unique/i.test(error.message)
      ? "A disposition with this name already exists."
      : error.message;
    return { error: message };
  }

  revalidateDispositionPaths();
  return {};
}

export async function reorderDisposition(dispositionId: string, direction: "up" | "down") {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const { data: dispositions } = await supabase
    .from("call_dispositions")
    .select("id, sort_order")
    .order("sort_order");
  if (!dispositions) return { error: "Could not load dispositions." };

  const index = dispositions.findIndex((d) => d.id === dispositionId);
  if (index === -1) return { error: "Disposition not found." };

  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= dispositions.length) return {};

  const current = dispositions[index];
  const swapWith = dispositions[swapIndex];

  const [{ error: err1 }, { error: err2 }] = await Promise.all([
    supabase.from("call_dispositions").update({ sort_order: swapWith.sort_order }).eq("id", current.id),
    supabase.from("call_dispositions").update({ sort_order: current.sort_order }).eq("id", swapWith.id),
  ]);
  if (err1 || err2) return { error: (err1 ?? err2)?.message ?? "Reorder failed." };

  revalidateDispositionPaths();
  return {};
}

export async function deleteDisposition(dispositionId: string) {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const { error } = await supabase.from("call_dispositions").delete().eq("id", dispositionId);

  if (error) {
    // Postgres foreign_key_violation — this disposition is still assigned
    // to one or more call logs (call_logs.disposition_id is `on delete
    // restrict`).
    const message =
      error.code === "23503"
        ? "This disposition is still used on one or more call logs."
        : error.message;
    return { error: message };
  }

  revalidateDispositionPaths();
  return {};
}
