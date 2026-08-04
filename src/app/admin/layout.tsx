import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Topbar } from "@/components/layout/topbar";
import { isBirthdayToday } from "@/lib/utils";

export default async function AdminLayout({
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
  if (profile.role !== "admin") redirect("/agent/dashboard");

  const today = new Date().toISOString().slice(0, 10);
  const [{ count: followUpCount }, { data: allUsers }] = await Promise.all([
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("next_follow_up_date", today),
    supabase.from("users").select("id, name, birthday"),
  ]);

  const todaysBirthdays = (allUsers ?? [])
    .filter((u) => isBirthdayToday(u.birthday))
    .map((u) => ({ id: u.id, name: u.name }));

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar role="admin" />
      <div className="flex flex-1 flex-col pb-14 md:pb-0">
        <Topbar
          role="admin"
          id={profile.id}
          name={profile.name}
          email={profile.email}
          birthday={profile.birthday}
          followUpCount={followUpCount ?? 0}
          birthdays={todaysBirthdays}
        />
        <main className="flex-1 px-4 py-6 sm:px-8">{children}</main>
      </div>
      <MobileNav role="admin" />
    </div>
  );
}
