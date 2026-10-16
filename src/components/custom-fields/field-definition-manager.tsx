"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, ArrowDown, Pencil, Trash2, Plus, X, Loader2, ListChecks } from "lucide-react";
import type { LeadFieldDefinition, LeadFieldType } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import {
  createFieldDefinition,
  updateFieldDefinition,
  reorderFieldDefinition,
  deleteFieldDefinition,
} from "@/lib/actions/custom-fields";
import { useConfirm } from "@/components/ui/confirm-dialog";

const FIELD_TYPE_LABELS: Record<LeadFieldType, string> = {
  text: "Text",
  number: "Number",
  date: "Date",
  select: "Dropdown",
};

function FieldFields({
  defaultName = "",
  defaultType = "text" as LeadFieldType,
  defaultOptions = "",
  defaultIsRequired = false,
}: {
  defaultName?: string;
  defaultType?: LeadFieldType;
  defaultOptions?: string;
  defaultIsRequired?: boolean;
}) {
  const [fieldType, setFieldType] = React.useState<LeadFieldType>(defaultType);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" defaultValue={defaultName} required className="w-48" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="field_type">Type</Label>
          <Select
            id="field_type"
            name="field_type"
            defaultValue={defaultType}
            className="w-36"
            onChange={(e) => setFieldType(e.target.value as LeadFieldType)}
          >
            {Object.entries(FIELD_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <label className="flex items-center gap-1.5 pb-2.5 text-sm text-slate-700">
          <input type="checkbox" name="is_required" defaultChecked={defaultIsRequired} />
          Required
        </label>
      </div>
      {fieldType === "select" && (
        <div className="space-y-1.5">
          <Label htmlFor="options">Options (one per line)</Label>
          <Textarea
            id="options"
            name="options"
            rows={3}
            defaultValue={defaultOptions}
            placeholder={"Hot\nWarm\nCold"}
            className="max-w-sm"
          />
        </div>
      )}
      {fieldType !== "select" && <input type="hidden" name="options" value="" />}
    </div>
  );
}

function FieldRow({
  field,
  isFirst,
  isLast,
}: {
  field: LeadFieldDefinition;
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
    const result = await updateFieldDefinition(field.id, new FormData(e.currentTarget));
    setPending(false);
    if (result?.error) {
      setError(result.error);
      toast({ title: "Couldn't save field", description: result.error, variant: "error" });
      return;
    }
    toast({ title: "Field saved", variant: "success" });
    setEditing(false);
    router.refresh();
  }

  async function handleReorder(direction: "up" | "down") {
    setPending(true);
    setError(null);
    const result = await reorderFieldDefinition(field.id, direction);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      toast({ title: "Couldn't reorder field", description: result.error, variant: "error" });
      return;
    }
    toast({ title: "Field reordered", variant: "success" });
    router.refresh();
  }

  async function handleDelete() {
    const ok = await confirm({
      title: `Delete the "${field.name}" field?`,
      description: "Any values saved on leads for this field will be deleted too.",
      confirmLabel: "Delete field",
      variant: "destructive",
    });
    if (!ok) return;
    setPending(true);
    setError(null);
    const result = await deleteFieldDefinition(field.id);
    setPending(false);
    if (result?.error) {
      setError(result.error);
      toast({ title: "Couldn't delete field", description: result.error, variant: "error" });
      return;
    }
    toast({ title: "Field deleted", variant: "success" });
    router.refresh();
  }

  if (editing) {
    return (
      <li className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <form onSubmit={handleSave} className="space-y-3">
          {error && <Alert variant="error">{error}</Alert>}
          <FieldFields
            defaultName={field.name}
            defaultType={field.field_type}
            defaultOptions={(field.options ?? []).join("\n")}
            defaultIsRequired={field.is_required}
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
      <div>
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-slate-900">{field.name}</p>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
            {FIELD_TYPE_LABELS[field.field_type]}
          </span>
          {field.is_required && (
            <span className="rounded-full bg-warning-100 px-2 py-0.5 text-[11px] font-medium text-warning-800">
              Required
            </span>
          )}
        </div>
        {field.field_type === "select" && field.options && (
          <p className="mt-1 text-xs text-slate-400">{field.options.join(", ")}</p>
        )}
      </div>

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

export function FieldDefinitionManager({ fields }: { fields: LeadFieldDefinition[] }) {
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
    const result = await createFieldDefinition(new FormData(e.currentTarget));
    setPending(false);
    if (result?.error) {
      setError(result.error);
      toast({ title: "Couldn't add field", description: result.error, variant: "error" });
      return;
    }
    toast({ title: "Field added", variant: "success" });
    formRef.current?.reset();
    setAdding(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {fields.length === 0 && !adding && (
        <EmptyState
          icon={ListChecks}
          title="No custom fields yet"
          description="Add one below — it will show up on every lead."
        />
      )}

      <ul className="space-y-2">
        {fields.map((field, i) => (
          <FieldRow key={field.id} field={field} isFirst={i === 0} isLast={i === fields.length - 1} />
        ))}
      </ul>

      {adding ? (
        <Card>
          <form ref={formRef} onSubmit={handleAdd}>
            <CardContent className="space-y-3">
              {error && <Alert variant="error">{error}</Alert>}
              <FieldFields />
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={pending}>
                  {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Add field
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
          Add field
        </Button>
      )}
    </div>
  );
}
