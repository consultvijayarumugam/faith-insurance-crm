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
      status_id: parsed.data.status_id,
      policy_start_date: parsed.data.policy_start_date || null,
      policy_end_date: parsed.data.policy_end_date || null,
      next_follow_up_date: parsed.data.next_follow_up_date || null,
      proposal_amount:
        parsed.data.proposal_amount === "" ? null : Number(parsed.data.proposal_amount),
      proposal_sent_date: parsed.data.proposal_sent_date || null,
      proposal_notes: parsed.data.proposal_notes || null,
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
  /** Raw cell text per custom field definition id, from the upload wizard's
   * optional custom-field mapping section. Coerced/validated per the
   * field's type here, at insert time; a value that doesn't fit its type is
   * silently skipped rather than failing the whole row. */
  customFieldValues?: Record<string, string>;
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

  const [{ data: agentRow }, { data: statuses }, { data: fieldDefinitions }] = await Promise.all([
    supabase.from("users").select("id").eq("id", agentId).eq("role", "agent").maybeSingle(),
    supabase.from("lead_statuses").select("id, name, sort_order").order("sort_order"),
    supabase
      .from("lead_field_definitions")
      .select("id, name, field_type, options, is_required, sort_order"),
  ]);
  if (!agentRow) return { error: "Selected agent not found." };
  if (!statuses || statuses.length === 0) {
    return { error: "No lead statuses are configured. Set one up under Lead Statuses first." };
  }

  const statusIdByName = new Map(statuses.map((s) => [s.name, s.id]));
  const defaultStatusId = statuses[0].id;
  const fieldDefinitionById = new Map((fieldDefinitions ?? []).map((f) => [f.id, f]));

  // One insert per row (not a single batched multi-row insert) so a single
  // bad row can't roll back the whole statement — every row succeeds or
  // fails independently, and callers get back exactly which rows failed
  // and why instead of losing the entire batch. Rows are already validated
  // (shape + status name) by makeBulkLeadRowSchema before reaching here, so
  // this just resolves the status name to an id and inserts.
  const settled = await Promise.allSettled(
    rows.map(async ({ sourceRowNumber, data, customFieldValues }) => {
      const statusId = data.lead_status
        ? (statusIdByName.get(data.lead_status) ?? defaultStatusId)
        : defaultStatusId;

      const { data: inserted, error } = await supabase
        .from("leads")
        .insert({
          agent_id: agentId,
          name: data.name,
          mobile_number: data.mobile_number,
          email: data.email || null,
          product_pitched: data.product_pitched || null,
          value: data.value,
          status_id: statusId,
          policy_start_date: data.policy_start_date || null,
          policy_end_date: data.policy_end_date || null,
        })
        .select("id")
        .single();

      if (error) throw new Error(error.message);

      // Best-effort: a custom field value that doesn't fit its definition's
      // type is skipped, never allowed to undo the lead that was just
      // created. Mapping columns is optional, so most imports skip this.
      if (customFieldValues && Object.keys(customFieldValues).length > 0) {
        const valueRows = Object.entries(customFieldValues)
          .map(([fieldId, raw]) => {
            const def = fieldDefinitionById.get(fieldId);
            if (!def) return null;
            const trimmed = raw.trim();
            if (def.field_type === "number" && Number.isNaN(Number(trimmed))) return null;
            if (def.field_type === "date" && Number.isNaN(Date.parse(trimmed))) return null;
            if (def.field_type === "select" && !(def.options ?? []).includes(trimmed)) return null;
            return {
              lead_id: inserted.id,
              field_definition_id: fieldId,
              value_text: def.field_type === "text" || def.field_type === "select" ? trimmed : null,
              value_number: def.field_type === "number" ? Number(trimmed) : null,
              value_date: def.field_type === "date" ? trimmed : null,
            };
          })
          .filter((r): r is NonNullable<typeof r> => r !== null);

        if (valueRows.length > 0) {
          await supabase.from("lead_field_values").insert(valueRows);
        }
      }

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
