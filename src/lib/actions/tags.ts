"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { tagSchema } from "@/lib/validations/tags";

function revalidateTagPaths() {
  revalidatePath("/admin/tags");
  revalidatePath("/admin/leads");
  revalidatePath("/agent/leads");
}

export async function createTag(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const parsed = tagSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { data, error } = await supabase
    .from("tags")
    .insert({ name: parsed.data.name, color: parsed.data.color, created_by: user.id })
    .select("id, name, color, created_by, created_at")
    .single();

  if (error) {
    const message = /unique/i.test(error.message) ? "A tag with this name already exists." : error.message;
    return { error: message };
  }

  revalidateTagPaths();
  return { tag: data };
}

export async function deleteTag(tagId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return { error: "Only admins can delete tags." };

  const { error } = await supabase.from("tags").delete().eq("id", tagId);
  if (error) return { error: error.message };

  revalidateTagPaths();
  return {};
}

export async function tagLead(leadId: string, tagId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  // RLS (lead_tags_insert) scopes this to a lead the caller owns or is
  // admin for; onConflict makes re-tagging an already-tagged lead a no-op
  // instead of a unique-violation error.
  const { error } = await supabase
    .from("lead_tags")
    .upsert(
      { lead_id: leadId, tag_id: tagId, created_by: user.id },
      { onConflict: "lead_id,tag_id", ignoreDuplicates: true }
    );

  if (error) return { error: error.message };

  revalidatePath(`/agent/leads/${leadId}`);
  revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath("/agent/leads");
  revalidatePath("/admin/leads");
  return {};
}

export async function untagLead(leadId: string, tagId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { error } = await supabase
    .from("lead_tags")
    .delete()
    .eq("lead_id", leadId)
    .eq("tag_id", tagId);

  if (error) return { error: error.message };

  revalidatePath(`/agent/leads/${leadId}`);
  revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath("/agent/leads");
  revalidatePath("/admin/leads");
  return {};
}

export interface BulkTagResult {
  taggedCount: number;
  failed: { leadId: string; error: string }[];
}

export async function bulkTagLeads(
  leadIds: string[],
  tagId: string
): Promise<BulkTagResult | { error: string }> {
  if (!tagId) return { error: "Select a tag." };
  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    return { error: "No leads selected." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  // One upsert per lead (not a single batched multi-row upsert) so a lead
  // outside the caller's RLS scope — not expected via this UI, but possible
  // via a stale selection after a reassignment — fails on its own instead
  // of silently dropping the whole batch. Mirrors bulkImportLeads.
  const settled = await Promise.allSettled(
    leadIds.map(async (leadId) => {
      const { error } = await supabase
        .from("lead_tags")
        .upsert(
          { lead_id: leadId, tag_id: tagId, created_by: user.id },
          { onConflict: "lead_id,tag_id", ignoreDuplicates: true }
        );
      if (error) throw new Error(error.message);
      return leadId;
    })
  );

  let taggedCount = 0;
  const failed: { leadId: string; error: string }[] = [];

  settled.forEach((result, i) => {
    if (result.status === "fulfilled") {
      taggedCount++;
    } else {
      failed.push({
        leadId: leadIds[i],
        error: result.reason instanceof Error ? result.reason.message : "Unknown error",
      });
    }
  });

  revalidatePath("/admin/leads");
  revalidatePath("/agent/leads");
  return { taggedCount, failed };
}
