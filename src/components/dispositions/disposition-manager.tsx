"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, ArrowDown, Pencil, Trash2, Plus, X, Loader2, PhoneCall } from "lucide-react";
import type { CallDisposition } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import {
  createDisposition,
  updateDisposition,
  reorderDisposition,
  deleteDisposition,
} from "@/lib/actions/dispositions";
import { useConfirm } from "@/components/ui/confirm-dialog";

function DispositionFields({ defaultName = "" }: { defaultName?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="name">Name</Label>
      <Input id="name" name="name" defaultValue={defaultName} required className="w-56" />
    </div>
  );
}

function DispositionRow({
  disposition,
  isFirst,
  isLast,
}: {
  disposition: CallDisposition;
  isFirst: boolean;
  isLast: boolean;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const { toast } = useToast();
  const [editing, setEditing] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await updateDisposition(disposition.id, new FormData(e.currentTarget));
    setPending(false);
    if (result?.error) {
      setError(result.error);
      toast({ title: "Couldn't save disposition", description: result.error, variant: "error" });
      return;
    }
    toast({ title: "Disposition saved", variant: "success" });
    setEditing(false);
    router.refresh();
  }

  async function handleReorder(direction: "up" | "down") {
    setPending(true);
    setError(null);
    const result = await reorderDisposition(disposition.id, direction);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      toast({ title: "Couldn't reorder disposition", description: result.error, variant: "error" });
      return;
    }
    toast({ title: "Disposition reordered", variant: "success" });
    router.refresh();
  }

  async function handleDelete() {
    const ok = await confirm({
      title: `Delete the "${disposition.name}" disposition?`,
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    setPending(true);
    setError(null);
    const result = await deleteDisposition(disposition.id);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      toast({ title: "Couldn't delete disposition", description: result.error, variant: "error" });
      return;
    }
    toast({ title: "Disposition deleted", variant: "success" });
    router.refresh();
  }

  if (editing) {
    return (
      <li className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <form onSubmit={handleSave} className="space-y-3">
          {error && <Alert variant="error">{error}</Alert>}
          <DispositionFields defaultName={disposition.name} />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </Button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-medium text-slate-900">{disposition.name}</p>

      {error && <p className="w-full text-xs text-danger-600">{error}</p>}

      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11"
          disabled={isFirst || pending}
          onClick={() => handleReorder("up")}
          aria-label="Move up"
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11"
          disabled={isLast || pending}
          onClick={() => handleReorder("down")}
          aria-label="Move down"
        >
          <ArrowDown className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11"
          disabled={pending}
          onClick={() => setEditing(true)}
          aria-label="Edit"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11"
          disabled={pending}
          onClick={handleDelete}
          aria-label="Delete"
        >
          <Trash2 className="h-3.5 w-3.5 text-danger-600" />
        </Button>
      </div>
    </li>
  );
}

export function DispositionManager({ dispositions }: { dispositions: CallDisposition[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [adding, setAdding] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await createDisposition(new FormData(e.currentTarget));
    setPending(false);
    if (result?.error) {
      setError(result.error);
      toast({ title: "Couldn't add disposition", description: result.error, variant: "error" });
      return;
    }
    toast({ title: "Disposition added", variant: "success" });
    formRef.current?.reset();
    setAdding(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {dispositions.length === 0 && !adding ? (
        <EmptyState
          icon={PhoneCall}
          title="No call dispositions yet"
          description="Add your call outcomes below — agents pick one each time they log a call."
        />
      ) : (
        <ul className="space-y-2">
          {dispositions.map((d, i) => (
            <DispositionRow
              key={d.id}
              disposition={d}
              isFirst={i === 0}
              isLast={i === dispositions.length - 1}
            />
          ))}
        </ul>
      )}

      {adding ? (
        <Card>
          <form ref={formRef} onSubmit={handleAdd}>
            <CardContent className="space-y-3">
              {error && <Alert variant="error">{error}</Alert>}
              <DispositionFields />
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={pending}>
                  {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Add disposition
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setAdding(false);
                    setError(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </form>
        </Card>
      ) : (
        <Button type="button" variant="secondary" size="sm" onClick={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5" />
          Add disposition
        </Button>
      )}
    </div>
  );
}
