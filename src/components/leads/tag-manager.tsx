"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import type { Tag } from "@/types";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TagBadge } from "@/components/leads/tag-badge";
import { deleteTag } from "@/lib/actions/tags";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";

export function TagManager({ tags }: { tags: Tag[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const { toast } = useToast();
  const [pending, setPending] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function handleDelete(tag: Tag) {
    const ok = await confirm({
      title: `Delete the "${tag.name}" tag?`,
      description: "It will be removed from every lead that has it.",
      confirmLabel: "Delete tag",
      variant: "destructive",
    });
    if (!ok) return;
    setPending(tag.id);
    setError(null);
    const result = await deleteTag(tag.id);
    setPending(null);
    if (result?.error) {
      setError(result.error);
      toast({ title: "Couldn't delete tag", description: result.error, variant: "error" });
      return;
    }
    toast({ title: "Tag deleted", variant: "success" });
    router.refresh();
  }

  if (tags.length === 0) {
    return <p className="text-sm text-slate-500">No tags yet. Tags are created inline while tagging a lead.</p>;
  }

  return (
    <div className="space-y-3">
      {error && <Alert variant="error">{error}</Alert>}
      <ul className="space-y-2">
        {tags.map((tag) => (
          <li
            key={tag.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4"
          >
            <TagBadge tag={tag} />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={pending === tag.id}
              onClick={() => handleDelete(tag)}
              aria-label={`Delete ${tag.name}`}
            >
              <Trash2 className="h-3.5 w-3.5 text-rose-600" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
