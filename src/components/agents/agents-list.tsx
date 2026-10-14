import { Mail } from "lucide-react";
import { formatDate } from "@/lib/format";
import { ResetPasswordButton } from "@/components/agents/reset-password-button";

export interface AgentRow {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

export function AgentsList({ agents }: { agents: AgentRow[] }) {
  if (agents.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-sm text-slate-500">
          No agents yet. Invite your first one above.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-card md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Email</th>
              <th className="px-5 py-3">Joined</th>
              <th className="px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => (
              <tr key={agent.id} className="border-b border-slate-100 last:border-0">
                <td className="px-5 py-3.5 font-medium text-slate-900">{agent.name}</td>
                <td className="px-5 py-3.5 text-slate-600">{agent.email}</td>
                <td className="px-5 py-3.5 text-slate-500">
                  {formatDate(agent.created_at)}
                </td>
                <td className="px-5 py-3.5">
                  <ResetPasswordButton agentId={agent.id} agentName={agent.name} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card"
          >
            <p className="font-medium text-slate-900">{agent.name}</p>
            <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
              <Mail className="h-3 w-3" />
              {agent.email}
            </p>
            <p className="mt-2 text-xs text-slate-400">
              Joined {formatDate(agent.created_at)}
            </p>
            <div className="mt-3">
              <ResetPasswordButton agentId={agent.id} agentName={agent.name} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
