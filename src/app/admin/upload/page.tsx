import { createClient } from "@/lib/supabase/server";
import { UploadWizard } from "@/components/upload/upload-wizard";

export default async function AdminUploadPage() {
  const supabase = await createClient();
  const [{ data: agents }, { data: statuses }, { data: fieldDefinitions }] = await Promise.all([
    supabase.from("users").select("id, name").eq("role", "agent").order("name"),
    supabase.from("lead_statuses").select("name").order("sort_order"),
    supabase
      .from("lead_field_definitions")
      .select("id, name, field_type, options, is_required, sort_order")
      .order("sort_order"),
  ]);

  return (
    <UploadWizard
      agents={agents ?? []}
      statusNames={(statuses ?? []).map((s) => s.name)}
      fieldDefinitions={fieldDefinitions ?? []}
    />
  );
}
