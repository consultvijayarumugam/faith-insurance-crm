"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Phone, Loader2, Contact, Plus } from "lucide-react";
import type { Lead, Tag } from "@/types";
import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
import { TagBadge } from "@/components/leads/tag-badge";
import { FollowUpCell, ProposalCell } from "@/components/leads/lead-table-cells";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { formatCurrency, formatDate } from "@/lib/format";
import { bulkTagLeads } from "@/lib/actions/tags";

function TagChips({ tags }: { tags?: Tag[] }) {
  if (!tags || tags.length === 0) return <span className="text-slate-300">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((t) => (
        <TagBadge key={t.id} tag={t} />
      ))}
    </div>
  );
}

export function LeadsTable({ leads, allTags = [] }: { leads: Lead[]; allTags?: Tag[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [tagId, setTagId] = React.useState("");
  const [applying, setApplying] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === leads.length ? new Set() : new Set(leads.map((l) => l.id))));
  }

  async function handleApplyTag() {
    if (!tagId || selected.size === 0) return;
    setApplying(true);
    setError(null);
    const result = await bulkTagLeads(Array.from(selected), tagId);
    setApplying(false);
    if ("error" in result) {
      setError(result.error);
      toast({ title: "Couldn't apply tag", description: result.error, variant: "error" });
      return;
    }
    toast({ title: "Tag applied", variant: "success" });
    setSelected(new Set());
    setTagId("");
    router.refresh();
  }

  if (leads.length === 0) {
    return (
      <EmptyState
        icon={Contact}
        title="No leads match these filters"
        description="Try clearing a filter, or add your first lead to get started."
        action={
          <Link href="/agent/leads/new">
            <Button type="button" size="sm" className="min-h-11">
              <Plus className="h-3.5 w-3.5" />
              Add a lead
            </Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      {error && <Alert variant="error">{error}</Alert>}

      {selected.size > 0 && allTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5">
          <span className="text-sm font-medium text-brand-700">
            {selected.size} selected
          </span>
          <Select
            value={tagId}
            onChange={(e) => setTagId(e.target.value)}
            className="h-11 w-44 text-xs"
          >
            <option value="">Choose a tag…</option>
            {allTags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          <Button type="button" size="sm" className="min-h-11" disabled={!tagId || applying} onClick={handleApplyTag}>
            {applying && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Apply tag
          </Button>
          <Button type="button" size="sm" className="min-h-11" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-card md:block">
        <table className="w-full min-w-[1040px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
              <th className="w-10 px-5 py-3">
                <input
                  type="checkbox"
                  checked={selected.size === leads.length}
                  onChange={toggleAll}
                  aria-label="Select all leads"
                />
              </th>
              <th className="px-5 py-3">Lead</th>
              <th className="px-5 py-3">Product</th>
              <th className="px-5 py-3">Value</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Tags</th>
              <th className="px-5 py-3">Follow-up</th>
              <th className="px-5 py-3">Proposal</th>
              <th className="px-5 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr
                key={lead.id}
                className="group border-b border-slate-100 last:border-0"
              >
                <td className="px-5 py-3.5">
                  <input
                    type="checkbox"
                    checked={selected.has(lead.id)}
                    onChange={() => toggle(lead.id)}
                    aria-label={`Select ${lead.name}`}
                  />
                </td>
                <td className="p-0">
                  <Link
                    href={`/agent/leads/${lead.id}`}
                    className="block px-5 py-3.5"
                  >
                    <p className="font-medium text-slate-900">{lead.name}</p>
                    <p className="flex items-center gap-1 text-xs text-slate-400">
                      <Phone className="h-3 w-3" />
                      {lead.mobile_number}
                    </p>
                  </Link>
                </td>
                <td className="px-5 py-3.5 text-slate-600">
                  <Link href={`/agent/leads/${lead.id}`} className="block">
                    {lead.product_pitched || "—"}
                  </Link>
                </td>
                <td className="px-5 py-3.5 font-medium text-slate-900">
                  <Link href={`/agent/leads/${lead.id}`} className="block">
                    {formatCurrency(lead.value)}
                  </Link>
                </td>
                <td className="px-5 py-3.5">
                  <Link href={`/agent/leads/${lead.id}`} className="block">
                    <LeadStatusBadge status={lead.status} />
                  </Link>
                </td>
                <td className="px-5 py-3.5">
                  <TagChips tags={lead.tags} />
                </td>
                <td className="px-5 py-3.5">
                  <Link href={`/agent/leads/${lead.id}`} className="block">
                    <FollowUpCell date={lead.next_follow_up_date} />
                  </Link>
                </td>
                <td className="px-5 py-3.5">
                  <Link href={`/agent/leads/${lead.id}`} className="block">
                    <ProposalCell amount={lead.proposal_amount} sentDate={lead.proposal_sent_date} />
                  </Link>
                </td>
                <td className="px-5 py-3.5 text-slate-500">
                  <Link href={`/agent/leads/${lead.id}`} className="block">
                    {formatDate(lead.created_at)}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {leads.map((lead) => (
          <div
            key={lead.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={selected.has(lead.id)}
                  onChange={() => toggle(lead.id)}
                  aria-label={`Select ${lead.name}`}
                  className="mt-1"
                />
                <Link href={`/agent/leads/${lead.id}`} className="block">
                  <p className="font-medium text-slate-900">{lead.name}</p>
                  <p className="flex items-center gap-1 text-xs text-slate-400">
                    <Phone className="h-3 w-3" />
                    {lead.mobile_number}
                  </p>
                </Link>
              </div>
              <LeadStatusBadge status={lead.status} />
            </div>
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-slate-500">
                {lead.product_pitched || "—"}
              </span>
              <span className="font-medium text-slate-900">
                {formatCurrency(lead.value)}
              </span>
            </div>
            <div className="mt-2">
              <TagChips tags={lead.tags} />
            </div>
            <div className="mt-2 flex items-center justify-between">
              <FollowUpCell date={lead.next_follow_up_date} />
              <ProposalCell amount={lead.proposal_amount} sentDate={lead.proposal_sent_date} />
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Added {formatDate(lead.created_at)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
