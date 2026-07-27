import { createClient } from "@/lib/supabase/server";
import { UploadWizard } from "@/components/upload/upload-wizard";

export default async function AdminUploadPage() {
  const supabase = await createClient();
  const { data: agents } = await supabase
    .from("users")
    .select("id, name")
    .eq("role", "agent")
    .order("name");

  return <UploadWizard agents={agents ?? []} />;
}
