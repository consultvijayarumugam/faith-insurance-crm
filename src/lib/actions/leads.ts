"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { leadCreateSchema, leadUpdateSchema, noteCreateSchema } from "@/lib/validations/lead";
import type { BulkLeadRow } from "@/lib/validations/lead";
import { makeFieldValuesSchema } from "@/lib/validations/custom-fields";
import type { LeadFieldDefinition } from "@/types";
import { MAX_BULK_IMPORT_ROWS } from "@/lib/constants";

export interface CreateLeadResult {
  leadId: string;
}

export async function createLead(
  formData: FormData
): Promise<CreateLeadResult | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  const isAdmin = profile?.role === "admin";

  const parsed = leadCreateSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  // Never trust a client-supplied agent_id for a non-admin caller — the
  // agent-facing form doesn't even render this field. leads_insert's WITH
  // CHECK would reject a mismatched agent_id anyway, but resolving it
  // server-side keeps that intent explicit in app code too, not just in RLS.
  let agentId: string;
  if (isAdmin) {
    if (!parsed.data.agent_id) {
      return { error: "Select an agent to assign this lead to." };
    }
    const { data: agentRow } = await supabase
      .from("users")
      .select("id")
      .eq("id", parsed.data.agent_id)
      .eq("role", "agent")
      .maybeSingle();
    if (!agentRow) return { error: "Selected agent not found." };
    agentId = agentRow.id;
  } else {
    agentId = user.id;
  }

  // Cross-agent duplicate check via a narrow SECURITY DEFINER RPC (see
  // 0005_lead_duplicate_lookup.sql) — a plain query would be silently
  // filtered to the caller's own leads by leads_select, letting an agent
  // create a second lead for a number another agent already owns.
  const { data: dup, error: dupError } = await supabase.rpc("find_lead_by_mobile", {
    p_mobile: parsed.data.mobile_number,
  });
  if (dupError) return { error: dupError.message };
  const dupRow = dup?.[0];
  if (dupRow) {
    return {
      error: `This mobile number already belongs to "${dupRow.lead_name}" (owned by ${dupRow.owner_name}).`,
    };
  }

  let statusId = parsed.data.status_id;
  if (!statusId) {
    const { data: firstStatus } = await supabase
      .from("lead_statuses")
      .select("id")
      .order("sort_order")
      .limit(1)
      .maybeSingle();
    if (!firstStatus) {
      return { error: "No lead statuses are configured. Set one up under Lead Statuses first." };
    }
    statusId = firstStatus.id;
  }

  // Custom-field values are validated the same way saveFieldValues does —
  // unlike bulkImportLeads' silent-skip, a single manual creation surfaces a
  // bad/missing required value as a real error instead of quietly dropping it.
  const { data: fieldDefinitionsData } = await supabase
    .from("lead_field_definitions")
    .select("id, name, field_type, options, is_required, sort_order")
    .order("sort_order");
  const fieldDefinitions = (fieldDefinitionsData ?? []) as LeadFieldDefinition[];

  let fieldValues: Record<string, string> = {};
  if (fieldDefinitions.length > 0) {
    const fieldSchema = makeFieldValuesSchema(fieldDefinitions);
    const parsedFields = fieldSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsedFields.success) {
      return { error: parsedFields.error.issues[0]?.message ?? "Invalid custom field value" };
    }
    fieldValues = parsedFields.data as Record<string, string>;
  }

  const { data: inserted, error } = await supabase
    .from("leads")
    .insert({
      agent_id: agentId,
      name: parsed.data.name,
      mobile_number: parsed.data.mobile_number,
      email: parsed.data.email || null,
      product_pitched: parsed.data.product_pitched || null,
      value: parsed.data.value,
      status_id: statusId,
      policy_start_date: parsed.data.policy_start_date || null,
      policy_end_date: parsed.data.policy_end_date || null,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return { error: error?.message ?? "Could not create lead." };
  }

  const leadId = inserted.id as string;

  // Secondary writes (note, tags, custom field values) run after the lead
  // itself exists, scoped by the same RLS ownership rule as everywhere else.
  // Best-effort by design — same philosophy as bulkImportLeads: the lead
  // that was just created is never rolled back over one of these.
  const tasks: PromiseLike<unknown>[] = [];

  if (parsed.data.notes) {
    tasks.push(
      supabase
        .from("lead_notes")
        .insert({ lead_id: leadId, agent_id: user.id, note_text: parsed.data.notes })
    );
  }

  // leads.next_follow_up_date is trigger-derived from lead_follow_ups (see
  // 0006_follow_ups.sql) — this form's convenience date field creates the
  // first pending follow-up row rather than writing the column directly.
  if (parsed.data.next_follow_up_date) {
    tasks.push(
      supabase.from("lead_follow_ups").insert({
        lead_id: leadId,
        agent_id: agentId,
        scheduled_at: `${parsed.data.next_follow_up_date}T09:00:00`,
      })
    );
  }

  const tagIds = Array.from(new Set(formData.getAll("tag_ids").map(String).filter(Boolean)));
  if (tagIds.length > 0) {
    tasks.push(
      supabase
        .from("lead_tags")
        .insert(tagIds.map((tagId) => ({ lead_id: leadId, tag_id: tagId, created_by: user.id })))
    );
  }

  if (fieldDefinitions.length > 0) {
    const valueRows = fieldDefinitions
      .map((def) => {
        const raw = (fieldValues[`field_${def.id}`] ?? "").trim();
        if (!raw) return null;
        return {
          lead_id: leadId,
          field_definition_id: def.id,
          value_text: def.field_type === "text" || def.field_type === "select" ? raw : null,
          value_number: def.field_type === "number" ? Number(raw) : null,
          value_date: def.field_type === "date" ? raw : null,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);
    if (valueRows.length > 0) {
      tasks.push(supabase.from("lead_field_values").insert(valueRows));
    }
  }

  await Promise.allSettled(tasks);

  revalidatePath("/admin/leads");
  revalidatePath("/agent/leads");
  revalidatePath("/admin/dashboard");
  revalidatePath("/agent/dashboard");

  return { leadId };
}

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

  // This is an admin-only tool (the upload wizard only renders for admins),
  // but unlike reassignLead/updateLead it has no per-row ownership check RLS
  // could fall back on for enforcement — leads_insert's WITH CHECK allows
  // agent_id = auth.uid(), so without this, a non-admin agent calling the
  // action directly could self-import at bulk scale instead of one at a
  // time via createLead. Check explicitly rather than rely on RLS here.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };
  const { data: callerProfile } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (callerProfile?.role !== "admin") return { error: "Only admins can bulk-import leads." };

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
