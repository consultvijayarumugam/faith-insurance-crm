import { Phone } from "lucide-react";
import type { Lead } from "@/types";
import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
import { ReassignSelect } from "@/components/leads/reassign-select";
import { formatCurrency, formatDate } from "@/lib/format";

export function AdminLeadsTable({
  leads,
  agents,
}: {
  leads: Lead[];
  agents: { id: string; name: string }[];
}) {
  if (leads.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-sm text-slate-500">No leads match these filters.</p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-card md:block">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
              <th className="px-5 py-3">Lead</th>
              <th className="px-5 py-3">Agent</th>
              <th className="px-5 py-3">Product</th>
              <th className="px-5 py-3">Value</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id} className="border-b border-slate-100 last:border-0">
                <td className="px-5 py-3.5">
                  <p className="font-medium text-slate-900">{lead.name}</p>
                  <p className="flex items-center gap-1 text-xs text-slate-400">
                    <Phone className="h-3 w-3" />
                    {lead.mobile_number}
                  </p>
                </td>
                <td className="px-5 py-3.5">
                  <ReassignSelect
                    leadId={lead.id}
                    agents={agents}
                    currentAgentId={lead.agent_id}
                  />
                </td>
                <td className="px-5 py-3.5 text-slate-600">
                  {lead.product_pitched || "—"}
                </td>
                <td className="px-5 py-3.5 font-medium text-slate-900">
                  {formatCurrency(lead.value)}
                </td>
                <td className="px-5 py-3.5">
                  <LeadStatusBadge status={lead.lead_status} />
                </td>
                <td className="px-5 py-3.5 text-slate-500">
                  {formatDate(lead.created_at)}
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
              <div>
                <p className="font-medium text-slate-900">{lead.name}</p>
                <p className="flex items-center gap-1 text-xs text-slate-400">
                  <Phone className="h-3 w-3" />
                  {lead.mobile_number}
                </p>
              </div>
              <LeadStatusBadge status={lead.lead_status} />
            </div>
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-slate-500">
                {lead.product_pitched || "—"}
              </span>
              <span className="font-medium text-slate-900">
                {formatCurrency(lead.value)}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Added {formatDate(lead.created_at)}
            </p>
            <div className="mt-3 border-t border-slate-100 pt-3">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                Assigned agent
              </p>
              <ReassignSelect
                leadId={lead.id}
                agents={agents}
                currentAgentId={lead.agent_id}
              />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
