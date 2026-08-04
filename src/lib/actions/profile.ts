"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { profileUpdateSchema } from "@/lib/validations/profile";

// Updates the signed-in user's own name/birthday only. RLS's
// users_self_update policy scopes this to auth.uid()'s own row, and the
// protect_users_privileged_columns trigger clamps role/email/id/created_at
// back to their previous values regardless of what's sent here — this
// action never even attempts to touch those columns.
export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const parsed = profileUpdateSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { error } = await supabase
    .from("users")
    .update({
      name: parsed.data.name,
      birthday: parsed.data.birthday || null,
    })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/agent", "layout");
  revalidatePath("/admin", "layout");
  return {};
}
