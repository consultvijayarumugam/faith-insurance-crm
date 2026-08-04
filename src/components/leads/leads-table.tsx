import Link from "next/link";
import { Phone } from "lucide-react";
import type { Lead } from "@/types";
import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
import { FollowUpCell, ProposalCell } from "@/components/leads/lead-table-cells";
import { formatCurrency, formatDate } from "@/lib/format";

export function LeadsTable({ leads }: { leads: Lead[] }) {
  if (leads.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-sm text-slate-500">
          No leads match these filters.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-card md:block">
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
              <th className="px-5 py-3">Lead</th>
              <th className="px-5 py-3">Product</th>
              <th className="px-5 py-3">Value</th>
              <th className="px-5 py-3">Status</th>
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
          <Link
            key={lead.id}
            href={`/agent/leads/${lead.id}`}
            className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-card"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-slate-900">{lead.name}</p>
                <p className="flex items-center gap-1 text-xs text-slate-400">
                  <Phone className="h-3 w-3" />
                  {lead.mobile_number}
                </p>
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
            <div className="mt-2 flex items-center justify-between">
              <FollowUpCell date={lead.next_follow_up_date} />
              <ProposalCell amount={lead.proposal_amount} sentDate={lead.proposal_sent_date} />
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Added {formatDate(lead.created_at)}
            </p>
          </Link>
        ))}
      </div>
    </>
  );
}
