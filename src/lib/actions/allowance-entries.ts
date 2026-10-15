"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  allowanceEntrySchema,
  allowanceExpenseSchema,
} from "@/lib/validations/allowance";
import { isMissingRateError, monthParamToDate } from "@/lib/allowance";

const MISSING_RATE_MESSAGE =
  "Rates haven't been set up yet. Please ask your admin to add travel rates in Allowance Settings before you can save this entry.";

function friendlyEntryError(message: string): string {
  return isMissingRateError(message) ? MISSING_RATE_MESSAGE : message;
}

const RECEIPT_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const RECEIPT_MAX_BYTES = 10 * 1024 * 1024;

function revalidateAllowancePaths() {
  revalidatePath("/agent/allowances");
  revalidatePath("/admin/allowances");
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, userId: null, error: "You must be signed in." } as const;
  return { supabase, userId: user.id, error: null } as const;
}

async function getOrCreateDraftClaim(
  supabase: Awaited<ReturnType<typeof createClient>>,
  agentId: string,
  month: string
) {
  const monthDate = monthParamToDate(month);
  const { data: existing } = await supabase
    .from("allowance_claims")
    .select("id, status")
    .eq("agent_id", agentId)
    .eq("month", monthDate)
    .maybeSingle();
  if (existing) return existing;

  const { data: created, error } = await supabase
    .from("allowance_claims")
    .insert({ agent_id: agentId, month: monthDate })
    .select("id, status")
    .single();
  if (error) throw error;
  return created;
}

export async function upsertEntry(entryId: string | null, formData: FormData) {
  const { supabase, userId, error: authError } = await requireUser();
  if (authError) return { error: authError };

  const parsed = allowanceEntrySchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const month = parsed.data.entry_date.slice(0, 7);

  let claim: { id: string; status: string };
  try {
    claim = await getOrCreateDraftClaim(supabase, userId!, month);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not prepare this month's claim." };
  }

  if (!entryId && claim.status !== "draft") {
    return { error: "This month has already been submitted — you can only fix a rejected entry." };
  }

  const payload = {
    entry_date: parsed.data.entry_date,
    vehicle_type: parsed.data.vehicle_type,
    km: parsed.data.km,
    purpose: parsed.data.purpose,
    notes: parsed.data.notes || null,
  };

  if (entryId) {
    const { error } = await supabase.from("allowance_entries").update(payload).eq("id", entryId);
    if (error) return { error: friendlyEntryError(error.message) };
  } else {
    const { error } = await supabase
      .from("allowance_entries")
      .insert({ ...payload, claim_id: claim.id, agent_id: userId! });
    if (error) {
      if (error.code === "23505") return { error: "You already have an entry for this date — edit it instead." };
      return { error: friendlyEntryError(error.message) };
    }
  }

  revalidateAllowancePaths();
  return {};
}

export async function deleteEntry(entryId: string) {
  const { supabase, error: authError } = await requireUser();
  if (authError) return { error: authError };

  const { data, error } = await supabase.from("allowance_entries").delete().eq("id", entryId).select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: "Couldn't delete — only a draft entry you own can be deleted." };
  }

  revalidateAllowancePaths();
  return {};
}

export async function addExpense(entryId: string, formData: FormData) {
  const { supabase, error: authError } = await requireUser();
  if (authError) return { error: authError };

  const parsed = allowanceExpenseSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { error } = await supabase.from("allowance_expenses").insert({
    entry_id: entryId,
    category: parsed.data.category,
    amount: parsed.data.amount,
    note: parsed.data.note || null,
  });
  if (error) return { error: error.message };

  revalidateAllowancePaths();
  return {};
}

export async function removeExpense(expenseId: string) {
  const { supabase, error: authError } = await requireUser();
  if (authError) return { error: authError };

  const { error } = await supabase.from("allowance_expenses").delete().eq("id", expenseId);
  if (error) return { error: error.message };

  revalidateAllowancePaths();
  return {};
}

export async function linkLeads(entryId: string, leadIds: string[]) {
  const { supabase, error: authError } = await requireUser();
  if (authError) return { error: authError };

  const { error: deleteError } = await supabase.from("allowance_entry_leads").delete().eq("entry_id", entryId);
  if (deleteError) return { error: deleteError.message };

  if (leadIds.length > 0) {
    const { error: insertError } = await supabase
      .from("allowance_entry_leads")
      .insert(leadIds.map((leadId) => ({ entry_id: entryId, lead_id: leadId })));
    if (insertError) return { error: insertError.message };
  }

  revalidateAllowancePaths();
  return {};
}

export async function uploadReceipt(entryId: string, formData: FormData) {
  const { supabase, userId, error: authError } = await requireUser();
  if (authError) return { error: authError };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a file to upload." };
  }
  if (!RECEIPT_ALLOWED_TYPES.includes(file.type)) {
    return { error: "Only JPEG, PNG, WEBP, or PDF files are allowed." };
  }
  if (file.size > RECEIPT_MAX_BYTES) {
    return { error: "File must be 10MB or smaller." };
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const path = `${userId}/${entryId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("allowance-receipts")
    .upload(path, file, { contentType: file.type });
  if (uploadError) return { error: uploadError.message };

  const { error: insertError } = await supabase.from("allowance_receipts").insert({
    entry_id: entryId,
    storage_path: path,
    file_name: file.name,
    content_type: file.type,
    size_bytes: file.size,
    uploaded_by: userId!,
  });
  if (insertError) {
    await supabase.storage.from("allowance-receipts").remove([path]);
    return { error: insertError.message };
  }

  revalidateAllowancePaths();
  return {};
}

export async function deleteReceipt(receiptId: string) {
  const { supabase, error: authError } = await requireUser();
  if (authError) return { error: authError };

  const { data: receipt } = await supabase
    .from("allowance_receipts")
    .select("storage_path")
    .eq("id", receiptId)
    .maybeSingle();
  if (!receipt) return { error: "Receipt not found." };

  const { error: deleteRowError } = await supabase.from("allowance_receipts").delete().eq("id", receiptId);
  if (deleteRowError) return { error: deleteRowError.message };

  await supabase.storage.from("allowance-receipts").remove([receipt.storage_path]);

  revalidateAllowancePaths();
  return {};
}

export async function submitMonth(month: string) {
  const { supabase, userId, error: authError } = await requireUser();
  if (authError) return { error: authError };

  const monthDate = monthParamToDate(month);
  const { data: claim } = await supabase
    .from("allowance_claims")
    .select("id, status")
    .eq("agent_id", userId!)
    .eq("month", monthDate)
    .maybeSingle();

  if (!claim) return { error: "Add at least one entry before submitting." };
  if (claim.status !== "draft") return { error: "This month has already been submitted." };

  const { count } = await supabase
    .from("allowance_entries")
    .select("id", { count: "exact", head: true })
    .eq("claim_id", claim.id);
  if (!count) return { error: "Add at least one entry before submitting." };

  const { error: entriesError } = await supabase
    .from("allowance_entries")
    .update({ status: "submitted" })
    .eq("claim_id", claim.id)
    .eq("status", "draft");
  if (entriesError) return { error: entriesError.message };

  const { error: claimError } = await supabase
    .from("allowance_claims")
    .update({ status: "submitted", submitted_at: new Date().toISOString() })
    .eq("id", claim.id);
  if (claimError) return { error: claimError.message };

  await supabase.from("allowance_audit_log").insert({
    entity_type: "claim",
    entity_id: claim.id,
    agent_id: userId!,
    action: "submitted",
    actor_id: userId!,
    from_status: "draft",
    to_status: "submitted",
  });

  revalidateAllowancePaths();
  return {};
}

export async function resubmitEntry(entryId: string, formData: FormData) {
  const { supabase, userId, error: authError } = await requireUser();
  if (authError) return { error: authError };

  const parsed = allowanceEntrySchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const { data: entry } = await supabase
    .from("allowance_entries")
    .select("id, status")
    .eq("id", entryId)
    .maybeSingle();
  if (!entry) return { error: "Entry not found." };
  if (entry.status !== "rejected") return { error: "Only a rejected entry can be resubmitted." };

  // entry_date is intentionally NOT taken from the form here, even though
  // the schema allows it — moving an entry to a different date could land
  // it outside its claim's month (claim_id doesn't change) or collide with
  // the unique(agent_id, entry_date) constraint on another day's entry.
  const { error } = await supabase
    .from("allowance_entries")
    .update({
      vehicle_type: parsed.data.vehicle_type,
      km: parsed.data.km,
      purpose: parsed.data.purpose,
      notes: parsed.data.notes || null,
      status: "submitted",
      rejection_reason: null,
    })
    .eq("id", entryId);
  if (error) return { error: friendlyEntryError(error.message) };

  await supabase.from("allowance_audit_log").insert({
    entity_type: "entry",
    entity_id: entryId,
    agent_id: userId!,
    action: "resubmitted",
    actor_id: userId!,
    from_status: "rejected",
    to_status: "submitted",
  });

  revalidateAllowancePaths();
  return {};
}
