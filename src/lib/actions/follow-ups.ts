"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { followUpScheduleSchema } from "@/lib/validations/follow-ups";

function revalidateFollowUpPaths(leadId: string) {
  revalidatePath(`/agent/leads/${leadId}`);
  revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath("/agent/leads");
  revalidatePath("/admin/leads");
  revalidatePath("/agent/calendar");
  revalidatePath("/admin/calendar");
}

function toScheduledAt(date: string, time: string): string {
  return `${date}T${time || "09:00"}:00`;
}

export async function scheduleFollowUp(leadId: string, formData: FormData) {
  const parsed = followUpScheduleSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  // agent_id on the row is the lead's owner, not necessarily the caller (an
  // admin can schedule a follow-up for an agent's lead) — this select also
  // doubles as the permission check: RLS (leads_select) returns nothing for
  // a lead the caller can't see.
  const { data: lead } = await supabase.from("leads").select("agent_id").eq("id", leadId).maybeSingle();
  if (!lead) return { error: "Lead not found or you don't have permission to edit it." };

  const { error } = await supabase.from("lead_follow_ups").insert({
    lead_id: leadId,
    agent_id: lead.agent_id,
    scheduled_at: toScheduledAt(parsed.data.scheduled_date, parsed.data.scheduled_time),
    notes: parsed.data.notes || null,
  });

  if (error) return { error: error.message };

  revalidateFollowUpPaths(leadId);
  return {};
}

export async function rescheduleFollowUp(followUpId: string, leadId: string, formData: FormData) {
  const parsed = followUpScheduleSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();

  // RLS (lead_follow_ups_update) scopes this to a follow-up on a lead the
  // caller owns or is admin for; the empty-result check turns a silently
  // filtered update into a visible error instead of a no-op.
  const { data, error } = await supabase
    .from("lead_follow_ups")
    .update({
      scheduled_at: toScheduledAt(parsed.data.scheduled_date, parsed.data.scheduled_time),
      notes: parsed.data.notes || null,
    })
    .eq("id", followUpId)
    .select("id");

  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: "Follow-up not found or you don't have permission to edit it." };
  }

  revalidateFollowUpPaths(leadId);
  return {};
}

export async function completeFollowUp(followUpId: string, leadId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("lead_follow_ups")
    .update({ status: "done", completed_at: new Date().toISOString() })
    .eq("id", followUpId)
    .select("id");

  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: "Follow-up not found or you don't have permission to edit it." };
  }

  revalidateFollowUpPaths(leadId);
  return {};
}

export async function markFollowUpMissed(followUpId: string, leadId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("lead_follow_ups")
    .update({ status: "missed" })
    .eq("id", followUpId)
    .select("id");

  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: "Follow-up not found or you don't have permission to edit it." };
  }

  revalidateFollowUpPaths(leadId);
  return {};
}

export async function deleteFollowUp(followUpId: string, leadId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("lead_follow_ups")
    .delete()
    .eq("id", followUpId)
    .select("id");

  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: "Follow-up not found or you don't have permission to delete it." };
  }

  revalidateFollowUpPaths(leadId);
  return {};
}
