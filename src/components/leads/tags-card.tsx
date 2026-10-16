"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Tags as TagsIcon, Plus, Loader2 } from "lucide-react";
import type { Tag } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { TagBadge } from "@/components/leads/tag-badge";
import { createTag, tagLead, untagLead } from "@/lib/actions/tags";

const DEFAULT_COLOR = "#3B82F6";

export function TagsCard({
  leadId,
  leadTags,
  allTags,
}: {
  leadId: string;
  leadTags: Tag[];
  allTags: Tag[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [selectedExisting, setSelectedExisting] = React.useState("");
  const [newName, setNewName] = React.useState("");
  const [newColor, setNewColor] = React.useState(DEFAULT_COLOR);

  const appliedIds = new Set(leadTags.map((t) => t.id));
  const availableTags = allTags.filter((t) => !appliedIds.has(t.id));

  async function handleRemove(tagId: string) {
    setPending(true);
    setError(null);
    const result = await untagLead(leadId, tagId);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      toast({ title: "Couldn't remove tag", description: result.error, variant: "error" });
      return;
    }
    toast({ title: "Tag removed", variant: "success" });
    router.refresh();
  }

  async function handleAddExisting() {
    if (!selectedExisting) return;
    setPending(true);
    setError(null);
    const result = await tagLead(leadId, selectedExisting);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      toast({ title: "Couldn't apply tag", description: result.error, variant: "error" });
      return;
    }
    toast({ title: "Tag applied", variant: "success" });
    setSelectedExisting("");
    router.refresh();
  }

  async function handleCreateAndApply(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!newName.trim()) return;
    setPending(true);
    setError(null);

    const formData = new FormData();
    formData.set("name", newName.trim());
    formData.set("color", newColor);
    const created = await createTag(formData);
    if ("error" in created && created.error) {
      setPending(false);
      setError(created.error);
      toast({ title: "Couldn't create tag", description: created.error, variant: "error" });
      return;
    }
    if ("tag" in created && created.tag) {
      const result = await tagLead(leadId, created.tag.id);
      if (result?.error) {
        setPending(false);
        setError(result.error);
        toast({ title: "Couldn't apply new tag", description: result.error, variant: "error" });
        return;
      }
    }

    setPending(false);
    setNewName("");
    setNewColor(DEFAULT_COLOR);
    setCreating(false);
    toast({ title: "Tag created and applied", variant: "success" });
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="space-y-4">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          <TagsIcon className="h-4 w-4 text-slate-400" />
          Tags
        </h3>

        {error && <Alert variant="error">{error}</Alert>}

        <div className="flex flex-wrap items-center gap-2">
          {leadTags.length === 0 && (
            <p className="text-sm text-slate-500">No tags yet.</p>
          )}
          {leadTags.map((tag) => (
            <TagBadge key={tag.id} tag={tag} onRemove={() => handleRemove(tag.id)} />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          {availableTags.length > 0 && (
            <>
              <Select
                value={selectedExisting}
                onChange={(e) => setSelectedExisting(e.target.value)}
                disabled={pending}
                className="h-8 w-44 py-0 text-xs"
              >
                <option value="">Add existing tag…</option>
                {availableTags.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={pending || !selectedExisting}
                onClick={handleAddExisting}
              >
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Add"}
              </Button>
            </>
          )}

          {!creating ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => setCreating(true)}>
              <Plus className="h-3.5 w-3.5" />
              New tag
            </Button>
          ) : (
            <form onSubmit={handleCreateAndApply} className="flex flex-wrap items-center gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Tag name"
                className="h-8 w-32 text-xs"
                required
              />
              <input
                type="color"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="h-8 w-10 cursor-pointer rounded-lg border border-slate-300 bg-white p-1"
              />
              <Button type="submit" size="sm" disabled={pending}>
                {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Create
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setCreating(false)}>
                Cancel
              </Button>
            </form>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
