import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { LeadInfoCard } from "@/components/leads/lead-info-card";
import { NotesTimeline, type TimelineNote } from "@/components/leads/notes-timeline";
import { AddNoteForm } from "@/components/leads/add-note-form";
import { CustomFieldsCard } from "@/components/leads/custom-fields-card";
import { ReassignSelect } from "@/components/leads/reassign-select";
import { Label } from "@/components/ui/label";
import type { Lead, LeadFieldDefinition, LeadFieldValue } from "@/types";

export default async function AdminLeadDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();

  const [{ data: lead }, { data: statuses }, { data: agents }] = await Promise.all([
    supabase.from("leads").select("*, status:lead_statuses(*)").eq("id", params.id).single(),
    supabase
      .from("lead_statuses")
      .select("id, name, color, sort_order, is_won, is_lost")
      .order("sort_order"),
    supabase.from("users").select("id, name").eq("role", "agent").order("name"),
  ]);

  if (!lead) notFound();

  const [{ data: notesData }, { data: fieldDefinitions }, { data: fieldValues }] =
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
        href="/admin/leads"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to all leads
      </Link>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <Label htmlFor="admin-reassign" className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Assigned agent
          </Label>
          <div className="w-56" id="admin-reassign">
            <ReassignSelect leadId={params.id} agents={agents ?? []} currentAgentId={lead.agent_id} />
          </div>
        </CardContent>
      </Card>

      <LeadInfoCard lead={lead as unknown as Lead} statuses={statuses ?? []} />

      <CustomFieldsCard
        leadId={params.id}
        definitions={(fieldDefinitions ?? []) as LeadFieldDefinition[]}
        values={(fieldValues ?? []) as LeadFieldValue[]}
      />

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
