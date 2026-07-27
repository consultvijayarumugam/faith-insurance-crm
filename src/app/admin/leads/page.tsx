import { createClient } from "@/lib/supabase/server";
import { LeadsFilters } from "@/components/leads/leads-filters";
import { AdminLeadsTable } from "@/components/leads/admin-leads-table";
import type { Lead, LeadStatus } from "@/types";

export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: {
    agent?: string;
    status?: string;
    product?: string;
    from?: string;
    to?: string;
  };
}) {
  const supabase = await createClient();

  let query = supabase
    .from("leads")
    .select(
      "id, agent_id, name, mobile_number, email, product_pitched, value, lead_status, quote_shared, converted, policy_start_date, policy_end_date, created_at, updated_at"
    )
    .order("created_at", { ascending: false });

  if (searchParams.agent) {
    query = query.eq("agent_id", searchParams.agent);
  }
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

  const [{ data: leads }, { data: productRows }, { data: agents }] =
    await Promise.all([
      query,
      supabase.from("leads").select("product_pitched"),
      supabase
        .from("users")
        .select("id, name")
        .eq("role", "agent")
        .order("name"),
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
      <LeadsFilters products={products} agents={agents ?? []} />

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {(leads ?? []).length} lead{(leads ?? []).length === 1 ? "" : "s"}
        </p>
      </div>

      <AdminLeadsTable leads={(leads ?? []) as Lead[]} agents={agents ?? []} />
    </div>
  );
}
