"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { leadUpdateSchema, noteCreateSchema } from "@/lib/validations/lead";
import type { BulkLeadRow } from "@/lib/validations/lead";
import { MAX_BULK_IMPORT_ROWS } from "@/lib/constants";

export async function updateLead(leadId: string, formData: FormData) {
  const parsed = leadUpdateSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();

  // RLS (leads_update) already scopes this to leads the caller owns or is
  // admin for; the empty-result check below turns a silently-filtered
  // update into a user-visible error instead of a no-op that looks like
  // success.
  const { data, error } = await supabase
    .from("leads")
    .update({
      name: parsed.data.name,
      mobile_number: parsed.data.mobile_number,
      email: parsed.data.email || null,
      product_pitched: parsed.data.product_pitched || null,
      value: parsed.data.value,
      lead_status: parsed.data.lead_status,
      policy_start_date: parsed.data.policy_start_date || null,
      policy_end_date: parsed.data.policy_end_date || null,
    })
    .eq("id", leadId)
    .select("id");

  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: "Lead not found or you don't have permission to edit it." };
  }

  revalidatePath(`/agent/leads/${leadId}`);
  revalidatePath("/agent/leads");
  revalidatePath("/agent/dashboard");
  return {};
}

export async function addNote(leadId: string, formData: FormData) {
  const parsed = noteCreateSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in to add a note." };

  const { error } = await supabase.from("lead_notes").insert({
    lead_id: leadId,
    agent_id: user.id,
    note_text: parsed.data.note_text,
    call_type: parsed.data.call_type || null,
  });

  if (error) return { error: error.message };

  revalidatePath(`/agent/leads/${leadId}`);
  return {};
}

export async function reassignLead(leadId: string, newAgentId: string) {
  if (!newAgentId) return { error: "Select an agent." };

  const supabase = await createClient();

  // leads_update's WITH CHECK requires is_admin() for a row to land on a
  // different agent_id, so a non-admin hitting this action directly just
  // gets the same empty-result "no permission" response as everyone else.
  const { data, error } = await supabase
    .from("leads")
    .update({ agent_id: newAgentId })
    .eq("id", leadId)
    .select("id");

  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: "Lead not found or you don't have permission to reassign it." };
  }

  revalidatePath("/admin/leads");
  revalidatePath("/admin/dashboard");
  return {};
}

export interface BulkImportRowInput {
  sourceRowNumber: number;
  data: BulkLeadRow;
}

export interface BulkImportResult {
  insertedCount: number;
  failed: { rowNumber: number; error: string }[];
}

export async function bulkImportLeads(
  agentId: string,
  rows: BulkImportRowInput[]
): Promise<BulkImportResult | { error: string }> {
  if (!agentId) return { error: "Select an agent to assign these leads to." };
  if (!Array.isArray(rows) || rows.length === 0) {
    return { error: "No rows to import." };
  }
  if (rows.length > MAX_BULK_IMPORT_ROWS) {
    return {
      error: `Import is limited to ${MAX_BULK_IMPORT_ROWS} rows at a time. Please split the file into smaller batches.`,
    };
  }

  const supabase = await createClient();

  const { data: agentRow } = await supabase
    .from("users")
    .select("id")
    .eq("id", agentId)
    .eq("role", "agent")
    .maybeSingle();
  if (!agentRow) return { error: "Selected agent not found." };

  // One insert per row (not a single batched multi-row insert) so a single
  // bad row can't roll back the whole statement — every row succeeds or
  // fails independently, and callers get back exactly which rows failed
  // and why instead of losing the entire batch.
  const settled = await Promise.allSettled(
    rows.map(async ({ sourceRowNumber, data }) => {
      const parsed = leadUpdateSchema.safeParse(data);
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Invalid row");
      }

      const { error } = await supabase.from("leads").insert({
        agent_id: agentId,
        name: parsed.data.name,
        mobile_number: parsed.data.mobile_number,
        email: parsed.data.email || null,
        product_pitched: parsed.data.product_pitched || null,
        value: parsed.data.value,
        lead_status: parsed.data.lead_status,
        policy_start_date: parsed.data.policy_start_date || null,
        policy_end_date: parsed.data.policy_end_date || null,
      });

      if (error) throw new Error(error.message);
      return sourceRowNumber;
    })
  );

  let insertedCount = 0;
  const failed: { rowNumber: number; error: string }[] = [];

  settled.forEach((result, i) => {
    if (result.status === "fulfilled") {
      insertedCount++;
    } else {
      failed.push({
        rowNumber: rows[i].sourceRowNumber,
        error:
          result.reason instanceof Error
            ? result.reason.message
            : "Unknown error",
      });
    }
  });

  revalidatePath("/admin/leads");
  revalidatePath("/admin/dashboard");

  return { insertedCount, failed };
}
