"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, X, Loader2, ListChecks } from "lucide-react";
import type { LeadFieldDefinition, LeadFieldValue } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/format";
import { saveFieldValues } from "@/lib/actions/custom-fields";

function rawValueFor(def: LeadFieldDefinition, value: LeadFieldValue | undefined): string {
  if (!value) return "";
  if (def.field_type === "number") return value.value_number === null ? "" : String(value.value_number);
  if (def.field_type === "date") return value.value_date ?? "";
  return value.value_text ?? "";
}

function displayValueFor(def: LeadFieldDefinition, value: LeadFieldValue | undefined): string {
  const raw = rawValueFor(def, value);
  if (!raw) return "—";
  if (def.field_type === "date") return formatDate(raw);
  return raw;
}

export function CustomFieldsCard({
  leadId,
  definitions,
  values,
}: {
  leadId: string;
  definitions: LeadFieldDefinition[];
  values: LeadFieldValue[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (definitions.length === 0) return null;

  const valueByFieldId = new Map(values.map((v) => [v.field_definition_id, v]));

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const result = await saveFieldValues(leadId, new FormData(e.currentTarget));
    setPending(false);
    if (result?.error) {
      setError(result.error);
      toast({ title: "Couldn't save custom fields", description: result.error, variant: "error" });
      return;
    }
    toast({ title: "Custom fields saved", variant: "success" });
    setEditing(false);
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            <ListChecks className="h-4 w-4 text-slate-400" />
            Custom Fields
          </h3>
          {!editing && (
            <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
          )}
        </div>

        {!editing ? (
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {definitions.map((def) => (
              <div key={def.id}>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  {def.name}
                </dt>
                <dd className="mt-1 text-sm text-slate-900">
                  {displayValueFor(def, valueByFieldId.get(def.id))}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && <Alert variant="error">{error}</Alert>}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {definitions.map((def) => {
                const name = `field_${def.id}`;
                const defaultValue = rawValueFor(def, valueByFieldId.get(def.id));
                return (
                  <div key={def.id} className="space-y-1.5">
                    <Label htmlFor={name}>
                      {def.name}
                      {def.is_required && <span className="text-danger-500"> *</span>}
                    </Label>
                    {def.field_type === "select" ? (
                      <Select id={name} name={name} defaultValue={defaultValue}>
                        <option value="">Not set</option>
                        {(def.options ?? []).map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <Input
                        id={name}
                        name={name}
                        type={def.field_type === "number" ? "number" : def.field_type === "date" ? "date" : "text"}
                        step={def.field_type === "number" ? "0.01" : undefined}
                        defaultValue={defaultValue}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-2 border-t border-slate-100 pt-5">
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {pending ? "Saving…" : "Save"}
              </Button>
              <Button
                type="button"
                variant="ghost"
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
        )}
      </CardContent>
    </Card>
  );
}
