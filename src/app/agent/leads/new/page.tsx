import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { NewLeadForm } from "@/components/leads/new-lead-form";
import type { LeadFieldDefinition, Tag } from "@/types";

export default async function NewAgentLeadPage() {
  const supabase = await createClient();

  const [{ data: statuses }, { data: allTags }, { data: fieldDefinitions }] = await Promise.all([
    supabase
      .from("lead_statuses")
      .select("id, name, color, sort_order, is_won, is_lost")
      .order("sort_order"),
    supabase.from("tags").select("id, name, color, created_by, created_at").order("name"),
    supabase
      .from("lead_field_definitions")
      .select("id, name, field_type, options, is_required, sort_order")
      .order("sort_order"),
  ]);

  return (
    <div className="space-y-6">
      <Link
        href="/agent/leads"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to leads
      </Link>

      <h2 className="text-lg font-semibold tracking-tight text-slate-900">New lead</h2>

      <NewLeadForm
        basePath="/agent/leads"
        statuses={statuses ?? []}
        allTags={(allTags ?? []) as Tag[]}
        fieldDefinitions={(fieldDefinitions ?? []) as LeadFieldDefinition[]}
      />
    </div>
  );
}
