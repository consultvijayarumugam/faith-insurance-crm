import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Topbar } from "@/components/layout/topbar";
import { isBirthdayToday } from "@/lib/utils";
import { isNearIstMonthEnd } from "@/lib/allowance";

export default async function AgentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("id, name, email, role, birthday")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");
  if (profile.role === "admin") redirect("/admin/dashboard");

  const today = new Date().toISOString().slice(0, 10);
  const [{ count: followUpCount }, { count: decidedClaimsCount }, { count: draftEntryCount }] = await Promise.all([
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("next_follow_up_date", today),
    supabase
      .from("allowance_claims")
      .select("id", { count: "exact", head: true })
      .eq("agent_id", user.id)
      .in("status", ["approved", "partially_approved", "rejected"]),
    supabase
      .from("allowance_entries")
      .select("id", { count: "exact", head: true })
      .eq("agent_id", user.id)
      .eq("status", "draft"),
  ]);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar role="agent" />
      <div className="flex flex-1 flex-col pb-14 md:pb-0">
        <Topbar
          role="agent"
          id={profile.id}
          name={profile.name}
          email={profile.email}
          birthday={profile.birthday}
          followUpCount={followUpCount ?? 0}
          birthdays={isBirthdayToday(profile.birthday) ? [{ id: profile.id, name: profile.name }] : []}
          allowanceCount={decidedClaimsCount ?? 0}
          allowanceMessage={`${decidedClaimsCount ?? 0} allowance claim${decidedClaimsCount === 1 ? "" : "s"} decided — check the outcome`}
          monthEndReminder={isNearIstMonthEnd() && (draftEntryCount ?? 0) > 0}
        />
        <main className="flex-1 px-4 py-6 sm:px-8">{children}</main>
      </div>
      <MobileNav role="agent" />
    </div>
  );
}
