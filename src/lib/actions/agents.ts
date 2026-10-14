"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { inviteAgentSchema } from "@/lib/validations/agent";
import type { TempPasswordResult } from "@/types";

// Visually-unambiguous charset (no 0/O, 1/l/I) since this gets read back and
// retyped or copy-pasted by a human, not just machine-to-machine.
const PASSWORD_CHARS =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

function generateTempPassword(length = 14): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => PASSWORD_CHARS[b % PASSWORD_CHARS.length]).join("");
}

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
    return { supabase, error: "Only admins can manage agents." } as const;
  }

  return { supabase, error: null } as const;
}

export async function inviteAgent(
  formData: FormData
): Promise<TempPasswordResult | { error: string }> {
  const { error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const parsed = inviteAgentSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const tempPassword = generateTempPassword();
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { name: parsed.data.name, role: "agent" },
  });

  if (error) {
    const message = /already|registered|exists/i.test(error.message)
      ? "An account with this email already exists."
      : error.message;
    return { error: message };
  }

  revalidatePath("/admin/agents");
  return { name: parsed.data.name, email: parsed.data.email, tempPassword };
}

export async function resetAgentPassword(
  agentId: string
): Promise<TempPasswordResult | { error: string }> {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  // Re-derive the target from the DB rather than trusting a name/email the
  // client might pass alongside the id — and restrict to role = agent so
  // this can't be used to reset another admin's password from this screen.
  const { data: target } = await supabase
    .from("users")
    .select("id, name, email, role")
    .eq("id", agentId)
    .single();
  if (!target || target.role !== "agent") {
    return { error: "Agent not found." };
  }

  const tempPassword = generateTempPassword();
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(agentId, {
    password: tempPassword,
  });
  if (error) return { error: error.message };

  return { name: target.name, email: target.email, tempPassword };
}
