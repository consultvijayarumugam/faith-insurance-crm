import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { LeadInfoCard } from "@/components/leads/lead-info-card";
import { NotesTimeline, type TimelineNote } from "@/components/leads/notes-timeline";
import { AddNoteForm } from "@/components/leads/add-note-form";
import { CustomFieldsCard } from "@/components/leads/custom-fields-card";
import { TagsCard } from "@/components/leads/tags-card";
import type { Lead, LeadFieldDefinition, LeadFieldValue, Tag } from "@/types";

export default async function AgentLeadDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();

  // RLS returns no row if this lead doesn't belong to the signed-in agent.
  const [{ data: lead }, { data: statuses }] = await Promise.all([
    supabase.from("leads").select("*, status:lead_statuses(*)").eq("id", params.id).single(),
    supabase
      .from("lead_statuses")
      .select("id, name, color, sort_order, is_won, is_lost")
      .order("sort_order"),
  ]);

  if (!lead) notFound();

  const [{ data: notesData }, { data: fieldDefinitions }, { data: fieldValues }, { data: leadTagRows }, { data: allTags }] =
    await Promise.all([
      supabase
        .from("lead_notes")
        .select("id, note_text, call_type, created_at, agent_id")
        .eq("lead_id", params.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("lead_field_definitions")
        .select("id, name, field_type, options, is_required, sort_order")
        .order("sort_order"),
      supabase
        .from("lead_field_values")
        .select("id, lead_id, field_definition_id, value_text, value_number, value_date")
        .eq("lead_id", params.id),
      supabase
        .from("lead_tags")
        .select("tag:tags(id, name, color, created_by, created_at)")
        .eq("lead_id", params.id),
      supabase.from("tags").select("id, name, color, created_by, created_at").order("name"),
    ]);

  const notes = notesData ?? [];
  const authorIds = Array.from(
    new Set(notes.map((n) => n.agent_id).filter((id): id is string => Boolean(id)))
  );

  const authorNames = new Map<string, string>();
  if (authorIds.length > 0) {
    const { data: authors } = await supabase
      .from("users")
      .select("id, name")
      .in("id", authorIds);
    (authors ?? []).forEach((a) => authorNames.set(a.id, a.name));
  }

  const leadTags = (leadTagRows ?? [])
    .map((r) => r.tag)
    .filter((t): t is Tag => Boolean(t)) as unknown as Tag[];

  const timelineNotes: TimelineNote[] = notes.map((n) => ({
    id: n.id,
    note_text: n.note_text,
    call_type: n.call_type,
    created_at: n.created_at,
    authorName: n.agent_id ? authorNames.get(n.agent_id) ?? "Unknown" : "Unknown",
  }));

  return (
    <div className="space-y-6">
      <Link
        href="/agent/leads"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to leads
      </Link>

      <LeadInfoCard lead={lead as unknown as Lead} statuses={statuses ?? []} />

      <CustomFieldsCard
        leadId={params.id}
        definitions={(fieldDefinitions ?? []) as LeadFieldDefinition[]}
        values={(fieldValues ?? []) as LeadFieldValue[]}
      />

      <TagsCard leadId={params.id} leadTags={leadTags} allTags={(allTags ?? []) as Tag[]} />

      <Card>
        <CardContent className="space-y-6">
          <h3 className="text-base font-semibold text-slate-900">Activity</h3>
          <NotesTimeline notes={timelineNotes} />
          <div className="border-t border-slate-100 pt-5">
            <AddNoteForm leadId={params.id} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
