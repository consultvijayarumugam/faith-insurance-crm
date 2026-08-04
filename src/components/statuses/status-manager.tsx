"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, ArrowDown, Pencil, Trash2, Plus, X, Loader2 } from "lucide-react";
import type { LeadStatusOption } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import {
  createLeadStatus,
  updateLeadStatus,
  reorderLeadStatus,
  deleteLeadStatus,
} from "@/lib/actions/statuses";

function StatusFields({
  defaultName = "",
  defaultColor = "#3B82F6",
  defaultIsWon = false,
  defaultIsLost = false,
}: {
  defaultName?: string;
  defaultColor?: string;
  defaultIsWon?: boolean;
  defaultIsLost?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={defaultName} required className="w-44" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="color">Color</Label>
        <input
          id="color"
          name="color"
          type="color"
          defaultValue={defaultColor}
          className="h-10 w-14 cursor-pointer rounded-lg border border-slate-300 bg-white p-1"
        />
      </div>
      <label className="flex items-center gap-1.5 pb-2.5 text-sm text-slate-700">
        <input type="checkbox" name="is_won" defaultChecked={defaultIsWon} />
        Won (counts as converted)
      </label>
      <label className="flex items-center gap-1.5 pb-2.5 text-sm text-slate-700">
        <input type="checkbox" name="is_lost" defaultChecked={defaultIsLost} />
        Lost
      </label>
    </div>
  );
}

function StatusRow({
  status,
  isFirst,
  isLast,
}: {
  status: LeadStatusOption;
  isFirst: boolean;
  isLast: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await updateLeadStatus(status.id, new FormData(e.currentTarget));
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  async function handleReorder(direction: "up" | "down") {
    setPending(true);
    setError(null);
    const result = await reorderLeadStatus(status.id, direction);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm(`Delete the "${status.name}" status?`)) return;
    setPending(true);
    setError(null);
    const result = await deleteLeadStatus(status.id);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  if (editing) {
    return (
      <li className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <form onSubmit={handleSave} className="space-y-3">
          {error && <Alert variant="error">{error}</Alert>}
          <StatusFields
            defaultName={status.name}
            defaultColor={status.color}
            defaultIsWon={status.is_won}
            defaultIsLost={status.is_lost}
          />
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
      <div className="flex items-center gap-3">
        <span
          className="h-5 w-5 shrink-0 rounded-full border border-black/5"
          style={{ backgroundColor: status.color }}
        />
        <div>
          <p className="text-sm font-medium text-slate-900">{status.name}</p>
          <div className="mt-0.5 flex gap-1.5">
            {status.is_won && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                Won
              </span>
            )}
            {status.is_lost && (
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-700">
                Lost
              </span>
            )}
          </div>
        </div>
      </div>

      {error && <p className="w-full text-xs text-rose-600">{error}</p>}

      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
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
          disabled={pending}
          onClick={handleDelete}
          aria-label="Delete"
        >
          <Trash2 className="h-3.5 w-3.5 text-rose-600" />
        </Button>
      </div>
    </li>
  );
}

export function StatusManager({ statuses }: { statuses: LeadStatusOption[] }) {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const [adding, setAdding] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await createLeadStatus(new FormData(e.currentTarget));
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    formRef.current?.reset();
    setAdding(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {statuses.map((status, i) => (
          <StatusRow
            key={status.id}
            status={status}
            isFirst={i === 0}
            isLast={i === statuses.length - 1}
          />
        ))}
      </ul>

      {adding ? (
        <Card>
          <form ref={formRef} onSubmit={handleAdd}>
            <CardContent className="space-y-3">
              {error && <Alert variant="error">{error}</Alert>}
              <StatusFields />
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={pending}>
                  {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Add status
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
          Add status
        </Button>
      )}
    </div>
  );
}
