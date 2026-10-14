"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { callLogSchema } from "@/lib/validations/call-logs";

function revalidateCallLogPaths(leadId: string) {
  revalidatePath(`/agent/leads/${leadId}`);
  revalidatePath(`/admin/leads/${leadId}`);
}

function toStartedAt(date: string, time: string): string {
  return `${date}T${time || "09:00"}:00`;
}

export async function createCallLog(leadId: string, formData: FormData) {
  const parsed = callLogSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();

  // agent_id on the row is the lead's owner, not necessarily the caller —
  // same reasoning as lead_follow_ups.agent_id. This select also doubles as
  // the permission check: RLS (leads_select) returns nothing for a lead the
  // caller can't see.
  const { data: lead } = await supabase.from("leads").select("agent_id").eq("id", leadId).maybeSingle();
  if (!lead) return { error: "Lead not found or you don't have permission to edit it." };

  const { error } = await supabase.from("call_logs").insert({
    lead_id: leadId,
    agent_id: lead.agent_id,
    disposition_id: parsed.data.disposition_id,
    duration_seconds: Math.round(parsed.data.duration_minutes * 60),
    notes: parsed.data.notes || null,
    started_at: toStartedAt(parsed.data.started_date, parsed.data.started_time),
  });

  if (error) return { error: error.message };

  revalidateCallLogPaths(leadId);
  return {};
}

export async function deleteCallLog(callLogId: string, leadId: string) {
  const supabase = await createClient();

  // RLS (call_logs_delete) scopes this to a call log on a lead the caller
  // owns or is admin for.
  const { data, error } = await supabase.from("call_logs").delete().eq("id", callLogId).select("id");

  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: "Call log not found or you don't have permission to delete it." };
  }

  revalidateCallLogPaths(leadId);
  return {};
}
