import Link from "next/link";
import { Plus, UploadCloud } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { LeadsFilters } from "@/components/leads/leads-filters";
import { AdminLeadsTable } from "@/components/leads/admin-leads-table";
import { Button } from "@/components/ui/button";
import type { Lead, LeadFieldDefinition, Tag } from "@/types";

export default async function AdminLeadsPage(
  props: {
    searchParams: Promise<{
      agent?: string;
      status?: string;
      product?: string;
      from?: string;
      to?: string;
      followup?: string;
      cf?: string;
      cfv?: string;
      tag?: string;
    }>;
  }
) {
  const searchParams = await props.searchParams;
  const supabase = await createClient();

  // Tags are fetched as a separate query below (not embedded here) so that a
  // missing/misbehaving tags table — e.g. its migration hasn't been run yet
  // — can never take down the core leads list with it; the two queries fail
  // independently.
  let query = supabase
    .from("leads")
    .select(
      "id, agent_id, name, mobile_number, email, product_pitched, value, status_id, status:lead_statuses(*), converted, converted_at, policy_start_date, policy_end_date, next_follow_up_date, proposal_amount, proposal_sent_date, proposal_notes, created_at, updated_at"
    )
    .order("created_at", { ascending: false });

  if (searchParams.agent) {
    query = query.eq("agent_id", searchParams.agent);
  }
  if (searchParams.status) {
    query = query.eq("status_id", searchParams.status);
  }
  if (searchParams.product) {
    query = query.eq("product_pitched", searchParams.product);
  }
  if (searchParams.from) {
    query = query.gte("created_at", `${searchParams.from}T00:00:00`);
  }
  if (searchParams.to) {
    query = query.lte("created_at", `${searchParams.to}T23:59:59`);
  }
  if (searchParams.followup) {
    const date =
      searchParams.followup === "today"
        ? new Date().toISOString().slice(0, 10)
        : searchParams.followup;
    query = query.eq("next_follow_up_date", date);
  }

  // Custom-field filter: resolve matching lead ids from lead_field_values
  // first (Supabase's query builder has no EXISTS-subquery escape hatch),
  // then narrow the main leads query by id. A no-match filter is applied as
  // an impossible id so the query stays a real (empty) query rather than a
  // special-cased branch.
  const NO_MATCH_ID = "00000000-0000-0000-0000-000000000000";
  if (searchParams.cf) {
    let valuesQuery = supabase
      .from("lead_field_values")
      .select("lead_id")
      .eq("field_definition_id", searchParams.cf);
    valuesQuery = searchParams.cfv
      ? valuesQuery.eq("value_text", searchParams.cfv)
      : valuesQuery.not("value_text", "is", null);
    const { data: matchingValues } = await valuesQuery;
    const ids = (matchingValues ?? []).map((v) => v.lead_id);
    query = query.in("id", ids.length > 0 ? ids : [NO_MATCH_ID]);
  }

  if (searchParams.tag) {
    const { data: matchingTags } = await supabase
      .from("lead_tags")
      .select("lead_id")
      .eq("tag_id", searchParams.tag);
    const ids = (matchingTags ?? []).map((v) => v.lead_id);
    query = query.in("id", ids.length > 0 ? ids : [NO_MATCH_ID]);
  }

  const [{ data: leads }, { data: productRows }, { data: agents }, { data: statuses }, { data: fieldDefinitions }, { data: allTags }] =
    await Promise.all([
      query,
      supabase.from("leads").select("product_pitched"),
      supabase.from("users").select("id, name").eq("role", "agent").order("name"),
      supabase
        .from("lead_statuses")
        .select("id, name, color, sort_order, is_won, is_lost")
        .order("sort_order"),
      supabase.from("lead_field_definitions").select("id, name, field_type, options, is_required, sort_order"),
      supabase.from("tags").select("id, name, color, created_by, created_at").order("name"),
    ]);

  const selectFields = ((fieldDefinitions ?? []) as LeadFieldDefinition[]).filter(
    (f) => f.field_type === "select"
  );

  const leadIds = (leads ?? []).map((l) => l.id);
  const tagsByLeadId = new Map<string, Tag[]>();
  if (leadIds.length > 0) {
    const { data: leadTagRows } = await supabase
      .from("lead_tags")
      .select("lead_id, tag:tags(id, name, color, created_by, created_at)")
      .in("lead_id", leadIds);
    (leadTagRows ?? []).forEach((row) => {
      const tag = row.tag as unknown as Tag | null;
      if (!tag) return;
      const existing = tagsByLeadId.get(row.lead_id) ?? [];
      existing.push(tag);
      tagsByLeadId.set(row.lead_id, existing);
    });
  }

  const leadsWithTags: Lead[] = (leads ?? []).map((l) => ({
    ...(l as unknown as Lead),
    tags: tagsByLeadId.get(l.id) ?? [],
  }));

  const products = Array.from(
    new Set(
      (productRows ?? [])
        .map((row) => row.product_pitched)
        .filter((p): p is string => Boolean(p))
    )
  ).sort();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">Leads</h2>
        <div className="flex items-center gap-2">
          <Link href="/admin/upload">
            <Button type="button" variant="secondary" size="sm">
              <UploadCloud className="h-3.5 w-3.5" />
              Bulk upload
            </Button>
          </Link>
          <Link href="/admin/leads/new">
            <Button type="button" size="sm">
              <Plus className="h-3.5 w-3.5" />
              New lead
            </Button>
          </Link>
        </div>
      </div>

      <LeadsFilters
        products={products}
        agents={agents ?? []}
        statuses={statuses ?? []}
        selectFields={selectFields}
        tags={(allTags ?? []) as Tag[]}
      />

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {leadsWithTags.length} lead{leadsWithTags.length === 1 ? "" : "s"}
        </p>
      </div>

      <AdminLeadsTable
        leads={leadsWithTags}
        agents={agents ?? []}
        allTags={(allTags ?? []) as Tag[]}
      />
    </div>
  );
}
