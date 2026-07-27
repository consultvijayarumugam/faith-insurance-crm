import { createClient } from "@/lib/supabase/server";
import { LeadsFilters } from "@/components/leads/leads-filters";
import { LeadsTable } from "@/components/leads/leads-table";
import type { Lead, LeadStatus } from "@/types";

export default async function AgentLeadsPage({
  searchParams,
}: {
  searchParams: { status?: string; product?: string; from?: string; to?: string };
}) {
  const supabase = await createClient();

  let query = supabase
    .from("leads")
    .select(
      "id, agent_id, name, mobile_number, email, product_pitched, value, lead_status, quote_shared, converted, policy_start_date, policy_end_date, created_at, updated_at"
    )
    .order("created_at", { ascending: false });

  if (searchParams.status) {
    query = query.eq("lead_status", searchParams.status as LeadStatus);
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

  const [{ data: leads }, { data: productRows }] = await Promise.all([
    query,
    supabase.from("leads").select("product_pitched"),
  ]);

  const products = Array.from(
    new Set(
      (productRows ?? [])
        .map((row) => row.product_pitched)
        .filter((p): p is string => Boolean(p))
    )
  ).sort();

  return (
    <div className="space-y-6">
      <LeadsFilters products={products} />

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {(leads ?? []).length} lead{(leads ?? []).length === 1 ? "" : "s"}
        </p>
      </div>

      <LeadsTable leads={(leads ?? []) as Lead[]} />
    </div>
  );
}
