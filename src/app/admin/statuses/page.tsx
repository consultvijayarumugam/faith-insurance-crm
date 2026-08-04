import { createClient } from "@/lib/supabase/server";
import { StatusManager } from "@/components/statuses/status-manager";

export default async function AdminStatusesPage() {
  const supabase = await createClient();
  const { data: statuses } = await supabase
    .from("lead_statuses")
    .select("id, name, color, sort_order, is_won, is_lost")
    .order("sort_order");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">
          Lead Statuses
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Define your own pipeline stages. Mark one as &quot;Won&quot; to count it
          toward conversions and the closed cases report, or &quot;Lost&quot; for
          leads that didn&apos;t close.
        </p>
      </div>
      <StatusManager statuses={statuses ?? []} />
    </div>
  );
}
