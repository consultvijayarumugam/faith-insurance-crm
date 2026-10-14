"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { LeadFieldDefinition, LeadStatusOption, Tag } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { createLead } from "@/lib/actions/leads";

export function NewLeadForm({
  basePath,
  statuses,
  agents,
  allTags,
  fieldDefinitions,
}: {
  /** "/admin/leads" or "/agent/leads" — where the cancel link and the
   * post-create redirect to the new lead's detail page both point. */
  basePath: string;
  statuses: LeadStatusOption[];
  /** Present only on the admin form — its presence is what renders the
   * required "Assign to agent" field. */
  agents?: { id: string; name: string }[];
  allTags: Tag[];
  fieldDefinitions: LeadFieldDefinition[];
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const defaultStatusId = [...statuses].sort((a, b) => a.sort_order - b.sort_order)[0]?.id ?? "";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const result = await createLead(formData);

    setPending(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    router.push(`${basePath}/${result.leadId}`);
  }

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
          {error && <Alert variant="error">{error}</Alert>}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mobile_number">Mobile number</Label>
              <Input id="mobile_number" name="mobile_number" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="product_pitched">Product</Label>
              <Input id="product_pitched" name="product_pitched" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="value">Value</Label>
              <Input id="value" name="value" type="number" min="0" step="0.01" defaultValue={0} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="status_id">Status</Label>
              <Select id="status_id" name="status_id" defaultValue={defaultStatusId} required>
                {statuses.map((status) => (
                  <option key={status.id} value={status.id}>
                    {status.name}
                  </option>
                ))}
              </Select>
            </div>
            {agents && (
              <div className="space-y-1.5">
                <Label htmlFor="agent_id">Assign to agent</Label>
                <Select id="agent_id" name="agent_id" defaultValue="" required>
                  <option value="" disabled>
                    Select an agent…
                  </option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="next_follow_up_date">Next follow-up</Label>
              <Input id="next_follow_up_date" name="next_follow_up_date" type="date" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="policy_start_date">Policy start</Label>
              <Input id="policy_start_date" name="policy_start_date" type="date" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="policy_end_date">Policy end</Label>
              <Input id="policy_end_date" name="policy_end_date" type="date" />
            </div>
          </div>

          <div className="space-y-1.5 border-t border-slate-100 pt-5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={3} />
          </div>

          {allTags.length > 0 && (
            <div className="space-y-2 border-t border-slate-100 pt-5">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-3">
                {allTags.map((tag) => (
                  <label key={tag.id} className="flex items-center gap-1.5 text-sm text-slate-700">
                    <input type="checkbox" name="tag_ids" value={tag.id} />
                    {tag.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          {fieldDefinitions.length > 0 && (
            <div className="space-y-4 border-t border-slate-100 pt-5">
              <h3 className="text-sm font-semibold text-slate-900">Custom Fields</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {fieldDefinitions.map((def) => {
                  const name = `field_${def.id}`;
                  return (
                    <div key={def.id} className="space-y-1.5">
                      <Label htmlFor={name}>
                        {def.name}
                        {def.is_required && <span className="text-rose-500"> *</span>}
                      </Label>
                      {def.field_type === "select" ? (
                        <Select id={name} name={name} defaultValue="">
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
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 border-t border-slate-100 pt-5">
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {pending ? "Creating…" : "Create lead"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => router.push(basePath)}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </form>
    </Card>
  );
}
