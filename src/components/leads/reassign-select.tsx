"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { reassignLead } from "@/lib/actions/leads";

export function ReassignSelect({
  leadId,
  agents,
  currentAgentId,
}: {
  leadId: string;
  agents: { id: string; name: string }[];
  currentAgentId: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [value, setValue] = React.useState(currentAgentId);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newAgentId = e.target.value;
    const previous = value;
    setValue(newAgentId);
    setPending(true);
    setError(null);

    const result = await reassignLead(leadId, newAgentId);

    setPending(false);
    if (result?.error) {
      setError(result.error);
      setValue(previous);
      toast({ title: "Couldn't reassign lead", description: result.error, variant: "error" });
      return;
    }
    const newAgentName = agents.find((a) => a.id === newAgentId)?.name ?? "the new agent";
    toast({ title: `Reassigned to ${newAgentName}`, variant: "success" });
    router.refresh();
  }

  return (
    <div className="space-y-1">
      <Select
        value={value}
        onChange={handleChange}
        disabled={pending}
        className="h-11 text-xs"
      >
        {agents.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </Select>
      {pending && (
        <p className="flex items-center gap-1 text-xs text-slate-400">
          <Loader2 className="h-3 w-3 animate-spin" />
          Reassigning…
        </p>
      )}
      {error && <p className="text-xs text-danger-600">{error}</p>}
    </div>
  );
}
