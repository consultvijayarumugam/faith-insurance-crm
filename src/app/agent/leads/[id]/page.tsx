import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { LeadInfoCard } from "@/components/leads/lead-info-card";
import { NotesTimeline, type TimelineNote } from "@/components/leads/notes-timeline";
import { AddNoteForm } from "@/components/leads/add-note-form";

export default async function AgentLeadDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();

  // RLS returns no row if this lead doesn't belong to the signed-in agent.
  const { data: lead } = await supabase
    .from("leads")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!lead) notFound();

  const { data: notesData } = await supabase
    .from("lead_notes")
    .select("id, note_text, call_type, created_at, agent_id")
    .eq("lead_id", params.id)
    .order("created_at", { ascending: false });

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
        href="/agent/leads"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to leads
      </Link>

      <LeadInfoCard lead={lead} />

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
