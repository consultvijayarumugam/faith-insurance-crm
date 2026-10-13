import { createClient } from "@/lib/supabase/server";
import { LeadsFilters } from "@/components/leads/leads-filters";
import { LeadsTable } from "@/components/leads/leads-table";
import type { Lead, LeadFieldDefinition } from "@/types";

export default async function AgentLeadsPage({
  searchParams,
}: {
  searchParams: {
    status?: string;
    product?: string;
    from?: string;
    to?: string;
    followup?: string;
    cf?: string;
    cfv?: string;
  };
}) {
  const supabase = await createClient();

  let query = supabase
    .from("leads")
    .select(
      "id, agent_id, name, mobile_number, email, product_pitched, value, status_id, status:lead_statuses(*), converted, converted_at, policy_start_date, policy_end_date, next_follow_up_date, proposal_amount, proposal_sent_date, proposal_notes, created_at, updated_at"
    )
    .order("created_at", { ascending: false });

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

  const [{ data: leads }, { data: productRows }, { data: statuses }, { data: fieldDefinitions }] =
    await Promise.all([
      query,
      supabase.from("leads").select("product_pitched"),
      supabase.from("lead_statuses").select("id, name, color, sort_order, is_won, is_lost").order("sort_order"),
      supabase.from("lead_field_definitions").select("id, name, field_type, options, is_required, sort_order"),
    ]);

  const selectFields = ((fieldDefinitions ?? []) as LeadFieldDefinition[]).filter(
    (f) => f.field_type === "select"
  );

  const products = Array.from(
    new Set(
      (productRows ?? [])
        .map((row) => row.product_pitched)
        .filter((p): p is string => Boolean(p))
    )
  ).sort();

  return (
    <div className="space-y-6">
      <LeadsFilters products={products} statuses={statuses ?? []} selectFields={selectFields} />

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {(leads ?? []).length} lead{(leads ?? []).length === 1 ? "" : "s"}
        </p>
      </div>

      <LeadsTable leads={(leads ?? []) as unknown as Lead[]} />
    </div>
  );
}
