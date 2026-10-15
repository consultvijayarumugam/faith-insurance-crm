"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  allowanceRejectReasonSchema,
  allowanceReopenReasonSchema,
  allowanceMarkPaidSchema,
} from "@/lib/validations/allowance";

function revalidateAllowancePaths() {
  revalidatePath("/agent/allowances");
  revalidatePath("/admin/allowances");
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, adminId: null, error: "You must be signed in." } as const;

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") {
    return { supabase, adminId: null, error: "Only admins can review allowance claims." } as const;
  }

  return { supabase, adminId: user.id, error: null } as const;
}

export async function approveEntry(entryId: string) {
  const { supabase, adminId, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const { data: entry } = await supabase
    .from("allowance_entries")
    .select("id, agent_id, status")
    .eq("id", entryId)
    .maybeSingle();
  if (!entry) return { error: "Entry not found." };
  if (entry.status !== "submitted") return { error: "Only a submitted entry can be approved." };

  const { error } = await supabase
    .from("allowance_entries")
    .update({
      status: "approved",
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: null,
    })
    .eq("id", entryId);
  if (error) return { error: error.message };

  await supabase.from("allowance_audit_log").insert({
    entity_type: "entry",
    entity_id: entryId,
    agent_id: entry.agent_id,
    action: "approved",
    actor_id: adminId!,
    from_status: "submitted",
    to_status: "approved",
  });

  revalidateAllowancePaths();
  return {};
}

export async function rejectEntry(entryId: string, formData: FormData) {
  const { supabase, adminId, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const parsed = allowanceRejectReasonSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { data: entry } = await supabase
    .from("allowance_entries")
    .select("id, agent_id, status")
    .eq("id", entryId)
    .maybeSingle();
  if (!entry) return { error: "Entry not found." };
  if (entry.status !== "submitted") return { error: "Only a submitted entry can be rejected." };

  const { error } = await supabase
    .from("allowance_entries")
    .update({
      status: "rejected",
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
      rejection_reason: parsed.data.reason,
    })
    .eq("id", entryId);
  if (error) return { error: error.message };

  await supabase.from("allowance_audit_log").insert({
    entity_type: "entry",
    entity_id: entryId,
    agent_id: entry.agent_id,
    action: "rejected",
    actor_id: adminId!,
    from_status: "submitted",
    to_status: "rejected",
    reason: parsed.data.reason,
  });

  revalidateAllowancePaths();
  return {};
}

export async function markClaimPaid(claimId: string, formData: FormData) {
  const { supabase, adminId, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const parsed = allowanceMarkPaidSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { data: claim } = await supabase
    .from("allowance_claims")
    .select("id, agent_id, status")
    .eq("id", claimId)
    .maybeSingle();
  if (!claim) return { error: "Claim not found." };
  if (claim.status !== "approved" && claim.status !== "partially_approved") {
    return { error: "Only an approved or partially approved claim can be marked paid." };
  }

  const { error } = await supabase
    .from("allowance_claims")
    .update({
      status: "paid",
      paid_at: `${parsed.data.paid_at}T00:00:00+05:30`,
      payment_reference: parsed.data.payment_reference,
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", claimId);
  if (error) return { error: error.message };

  await supabase.from("allowance_audit_log").insert({
    entity_type: "claim",
    entity_id: claimId,
    agent_id: claim.agent_id,
    action: "paid",
    actor_id: adminId!,
    from_status: claim.status,
    to_status: "paid",
    reason: parsed.data.payment_reference,
  });

  revalidateAllowancePaths();
  return {};
}

export async function reopenClaim(claimId: string, formData: FormData) {
  const { supabase, adminId, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const parsed = allowanceReopenReasonSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { data: claim } = await supabase
    .from("allowance_claims")
    .select("id, agent_id, status")
    .eq("id", claimId)
    .maybeSingle();
  if (!claim) return { error: "Claim not found." };
  if (!["approved", "partially_approved", "rejected", "paid"].includes(claim.status)) {
    return { error: "This claim isn't in a reviewed state." };
  }

  // Re-open every decided line back to submitted so it can be acted on
  // again (the agent can also then resubmit a still-rejected one).
  const { error: entriesError } = await supabase
    .from("allowance_entries")
    .update({ status: "submitted", reviewed_by: null, reviewed_at: null, rejection_reason: null })
    .eq("claim_id", claimId)
    .in("status", ["approved", "rejected"]);
  if (entriesError) return { error: entriesError.message };

  const { error: claimError } = await supabase
    .from("allowance_claims")
    .update({ status: "submitted", paid_at: null, payment_reference: null })
    .eq("id", claimId);
  if (claimError) return { error: claimError.message };

  await supabase.from("allowance_audit_log").insert({
    entity_type: "claim",
    entity_id: claimId,
    agent_id: claim.agent_id,
    action: "reopened",
    actor_id: adminId!,
    from_status: claim.status,
    to_status: "submitted",
    reason: parsed.data.reason,
  });

  revalidateAllowancePaths();
  return {};
}
