import { createClient } from "@/lib/supabase/server";
import { TagManager } from "@/components/leads/tag-manager";

export default async function AdminTagsPage() {
  const supabase = await createClient();
  const { data: tags } = await supabase
    .from("tags")
    .select("id, name, color, created_by, created_at")
    .order("name");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">Tags</h2>
        <p className="mt-1 text-sm text-slate-500">
          Any agent or admin can create a tag while tagging a lead. Delete one
          here to remove it everywhere it&apos;s applied.
        </p>
      </div>
      <TagManager tags={tags ?? []} />
    </div>
  );
}
