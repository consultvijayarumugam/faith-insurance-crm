"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Phone, Mail, Calendar, Pencil, X, Loader2, CalendarClock, FileText } from "lucide-react";
import type { Lead, LeadStatusOption } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { updateLead } from "@/lib/actions/leads";
import { useToast } from "@/components/ui/toast";

export function LeadInfoCard({ lead, statuses }: { lead: Lead; statuses: LeadStatusOption[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const wasWon = lead.status?.is_won ?? false;
    const newStatusId = formData.get("status_id");
    const newStatus = statuses.find((s) => s.id === newStatusId);
    const result = await updateLead(lead.id, formData);

    setPending(false);
    if (result?.error) {
      setError(result.error);
      toast({ title: "Couldn't save changes", description: result.error, variant: "error" });
      return;
    }
    setEditing(false);
    if (!wasWon && newStatus?.is_won) {
      toast({
        title: `🎉 ${lead.name} just converted!`,
        description: "Nice work — this one's in the win column.",
        variant: "success",
      });
    } else {
      toast({ title: "Lead updated", variant: "success" });
    }
    router.refresh();
  }

  if (!editing) {
    return (
      <Card>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-900">
                {lead.name}
              </h2>
              <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                <Phone className="h-3.5 w-3.5" />
                {lead.mobile_number}
              </p>
              {lead.email && (
                <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                  <Mail className="h-3.5 w-3.5" />
                  {lead.email}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <LeadStatusBadge status={lead.status} />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setEditing(true)}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
            </div>
          </div>

          <dl className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-6 sm:grid-cols-3">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Product
              </dt>
              <dd className="mt-1 text-sm text-slate-900">
                {lead.product_pitched || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Value
              </dt>
              <dd className="mt-1 text-sm text-slate-900">
                {formatCurrency(lead.value)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Added
              </dt>
              <dd className="mt-1 flex items-center gap-1 text-sm text-slate-900">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                {formatDate(lead.created_at)}
              </dd>
            </div>
            {/* Derived from the earliest pending row in lead_follow_ups by a
                DB trigger — not editable here; schedule/reschedule via the
                Follow-ups card below. */}
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Next follow-up
              </dt>
              <dd className="mt-1 flex items-center gap-1 text-sm text-slate-900">
                <CalendarClock className="h-3.5 w-3.5 text-slate-400" />
                {lead.next_follow_up_date ? formatDate(lead.next_follow_up_date) : "None scheduled"}
              </dd>
            </div>
            {lead.policy_start_date && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Policy start
                </dt>
                <dd className="mt-1 text-sm text-slate-900">
                  {formatDate(lead.policy_start_date)}
                </dd>
              </div>
            )}
            {lead.policy_end_date && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Policy end
                </dt>
                <dd className="mt-1 text-sm text-slate-900">
                  {formatDate(lead.policy_end_date)}
                </dd>
              </div>
            )}
          </dl>

          <div className="border-t border-slate-100 pt-6">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              <FileText className="h-4 w-4 text-slate-400" />
              Proposal
            </h3>
            {lead.proposal_amount === null && !lead.proposal_sent_date && !lead.proposal_notes ? (
              <p className="mt-2 text-sm text-slate-500">No proposal recorded yet.</p>
            ) : (
              <dl className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Amount
                  </dt>
                  <dd className="mt-1 text-sm text-slate-900">
                    {lead.proposal_amount !== null ? formatCurrency(lead.proposal_amount) : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Sent
                  </dt>
                  <dd className="mt-1 text-sm text-slate-900">
                    {lead.proposal_sent_date ? formatDate(lead.proposal_sent_date) : "—"}
                  </dd>
                </div>
                {lead.proposal_notes && (
                  <div className="sm:col-span-3">
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Notes
                    </dt>
                    <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-900">
                      {lead.proposal_notes}
                    </dd>
                  </div>
                )}
              </dl>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-5">
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
            >
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={lead.name} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mobile_number">Mobile number</Label>
              <Input
                id="mobile_number"
                name="mobile_number"
                defaultValue={lead.mobile_number}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={lead.email ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="product_pitched">Product</Label>
              <Input
                id="product_pitched"
                name="product_pitched"
                defaultValue={lead.product_pitched ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="value">Value</Label>
              <Input
                id="value"
                name="value"
                type="number"
                min="0"
                step="0.01"
                defaultValue={lead.value}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="status_id">Status</Label>
              <Select
                id="status_id"
                name="status_id"
                defaultValue={lead.status_id}
                required
              >
                {statuses.map((status) => (
                  <option key={status.id} value={status.id}>
                    {status.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="policy_start_date">Policy start</Label>
              <Input
                id="policy_start_date"
                name="policy_start_date"
                type="date"
                defaultValue={lead.policy_start_date ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="policy_end_date">Policy end</Label>
              <Input
                id="policy_end_date"
                name="policy_end_date"
                type="date"
                defaultValue={lead.policy_end_date ?? ""}
              />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-5">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              <FileText className="h-4 w-4 text-slate-400" />
              Proposal
            </h3>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="proposal_amount">Proposal amount</Label>
                <Input
                  id="proposal_amount"
                  name="proposal_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={lead.proposal_amount ?? ""}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="proposal_sent_date">Sent date</Label>
                <Input
                  id="proposal_sent_date"
                  name="proposal_sent_date"
                  type="date"
                  defaultValue={lead.proposal_sent_date ?? ""}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="proposal_notes">Proposal notes</Label>
                <Textarea
                  id="proposal_notes"
                  name="proposal_notes"
                  rows={3}
                  defaultValue={lead.proposal_notes ?? ""}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 border-t border-slate-100 pt-5">
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {pending ? "Saving…" : "Save changes"}
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
        </CardContent>
      </form>
    </Card>
  );
}
