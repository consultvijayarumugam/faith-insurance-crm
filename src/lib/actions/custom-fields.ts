"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  leadFieldDefinitionSchema,
  makeFieldValuesSchema,
} from "@/lib/validations/custom-fields";
import type { LeadFieldDefinition } from "@/types";

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
    return { supabase, error: "Only admins can manage custom fields." } as const;
  }

  return { supabase, error: null } as const;
}

function parseOptions(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split("\n")
        .map((o) => o.trim())
        .filter(Boolean)
    )
  );
}

function revalidateFieldPaths() {
  revalidatePath("/admin/custom-fields");
  revalidatePath("/admin/leads");
  revalidatePath("/agent/leads");
  revalidatePath("/admin/upload");
}

export async function createFieldDefinition(formData: FormData) {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const parsed = leadFieldDefinitionSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { data: maxRow } = await supabase
    .from("lead_field_definitions")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSortOrder = (maxRow?.sort_order ?? 0) + 1;

  const { error } = await supabase.from("lead_field_definitions").insert({
    name: parsed.data.name,
    field_type: parsed.data.field_type,
    options: parsed.data.field_type === "select" ? parseOptions(parsed.data.options) : null,
    is_required: Boolean(parsed.data.is_required),
    sort_order: nextSortOrder,
  });

  if (error) {
    const message = /unique/i.test(error.message)
      ? "A field with this name already exists."
      : error.message;
    return { error: message };
  }

  revalidateFieldPaths();
  return {};
}

export async function updateFieldDefinition(fieldId: string, formData: FormData) {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const parsed = leadFieldDefinitionSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { error } = await supabase
    .from("lead_field_definitions")
    .update({
      name: parsed.data.name,
      field_type: parsed.data.field_type,
      options: parsed.data.field_type === "select" ? parseOptions(parsed.data.options) : null,
      is_required: Boolean(parsed.data.is_required),
    })
    .eq("id", fieldId);

  if (error) {
    const message = /unique/i.test(error.message)
      ? "A field with this name already exists."
      : error.message;
    return { error: message };
  }

  revalidateFieldPaths();
  return {};
}

export async function reorderFieldDefinition(fieldId: string, direction: "up" | "down") {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const { data: fields } = await supabase
    .from("lead_field_definitions")
    .select("id, sort_order")
    .order("sort_order");
  if (!fields) return { error: "Could not load custom fields." };

  const index = fields.findIndex((f) => f.id === fieldId);
  if (index === -1) return { error: "Field not found." };

  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= fields.length) return {};

  const current = fields[index];
  const swapWith = fields[swapIndex];

  const [{ error: err1 }, { error: err2 }] = await Promise.all([
    supabase
      .from("lead_field_definitions")
      .update({ sort_order: swapWith.sort_order })
      .eq("id", current.id),
    supabase
      .from("lead_field_definitions")
      .update({ sort_order: current.sort_order })
      .eq("id", swapWith.id),
  ]);
  if (err1 || err2) return { error: (err1 ?? err2)?.message ?? "Reorder failed." };

  revalidateFieldPaths();
  return {};
}

export async function deleteFieldDefinition(fieldId: string) {
  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { error: authError };

  const { error } = await supabase.from("lead_field_definitions").delete().eq("id", fieldId);
  if (error) return { error: error.message };

  revalidateFieldPaths();
  return {};
}

export async function saveFieldValues(leadId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { data: definitionsData } = await supabase
    .from("lead_field_definitions")
    .select("id, name, field_type, options, is_required, sort_order")
    .order("sort_order");
  const definitions = (definitionsData ?? []) as LeadFieldDefinition[];
  if (definitions.length === 0) return {};

  const schema = makeFieldValuesSchema(definitions);
  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const values = parsed.data as Record<string, string>;
  const rows = definitions.map((def) => {
    const raw = (values[`field_${def.id}`] ?? "").trim();
    return {
      lead_id: leadId,
      field_definition_id: def.id,
      value_text: def.field_type === "text" || def.field_type === "select" ? raw || null : null,
      value_number: def.field_type === "number" ? (raw === "" ? null : Number(raw)) : null,
      value_date: def.field_type === "date" ? raw || null : null,
    };
  });

  // RLS (lead_field_values_insert/_update) scopes this to a lead the caller
  // owns or is admin for; an unauthorized leadId simply upserts zero rows.
  const { data, error } = await supabase
    .from("lead_field_values")
    .upsert(rows, { onConflict: "lead_id,field_definition_id" })
    .select("id");

  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: "Lead not found or you don't have permission to edit it." };
  }

  revalidatePath(`/agent/leads/${leadId}`);
  revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath("/agent/leads");
  revalidatePath("/admin/leads");
  return {};
}
