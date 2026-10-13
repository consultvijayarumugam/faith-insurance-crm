import { createClient } from "@/lib/supabase/server";
import { FieldDefinitionManager } from "@/components/custom-fields/field-definition-manager";

export default async function AdminCustomFieldsPage() {
  const supabase = await createClient();
  const { data: fields } = await supabase
    .from("lead_field_definitions")
    .select("id, name, field_type, options, is_required, sort_order")
    .order("sort_order");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">
          Custom Lead Fields
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Define extra fields agents fill in on every lead — text, number,
          date, or a dropdown with your own options. Agents can fill these in
          but can&apos;t change the field list itself.
        </p>
      </div>
      <FieldDefinitionManager fields={fields ?? []} />
    </div>
  );
}
