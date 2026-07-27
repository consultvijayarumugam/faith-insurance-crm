import { createClient } from "@/lib/supabase/server";
import { InviteAgentForm } from "@/components/agents/invite-agent-form";
import { AgentsList } from "@/components/agents/agents-list";

export default async function AdminAgentsPage() {
  const supabase = await createClient();
  const { data: agents } = await supabase
    .from("users")
    .select("id, name, email, created_at")
    .eq("role", "agent")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <InviteAgentForm />
      <AgentsList agents={agents ?? []} />
    </div>
  );
}
