import { createClient } from "@/lib/supabase/server";
import { DispositionManager } from "@/components/dispositions/disposition-manager";

export default async function AdminDispositionsPage() {
  const supabase = await createClient();
  const { data: dispositions } = await supabase
    .from("call_dispositions")
    .select("id, name, sort_order")
    .order("sort_order");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">
          Call Dispositions
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Define the outcomes agents choose from when logging a call. Used by
          the call log on every lead and by performance reports.
        </p>
      </div>
      <DispositionManager dispositions={dispositions ?? []} />
    </div>
  );
}
