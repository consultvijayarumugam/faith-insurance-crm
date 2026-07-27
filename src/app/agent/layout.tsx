import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Topbar } from "@/components/layout/topbar";

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
    .select("name, email, role")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");
  if (profile.role === "admin") redirect("/admin/dashboard");

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar role="agent" />
      <div className="flex flex-1 flex-col pb-14 md:pb-0">
        <Topbar role="agent" name={profile.name} email={profile.email} />
        <main className="flex-1 px-4 py-6 sm:px-8">{children}</main>
      </div>
      <MobileNav role="agent" />
    </div>
  );
}
