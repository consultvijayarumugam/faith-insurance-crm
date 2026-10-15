"use client";

import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { ProfileMenu } from "./profile-menu";
import { NotificationsMenu } from "./notifications-menu";
import { navItemsForRole, type Role } from "./nav-items";

export function Topbar({
  role,
  id,
  name,
  email,
  birthday,
  followUpCount,
  birthdays,
  allowanceCount,
  allowanceMessage,
  monthEndReminder,
}: {
  role: Role;
  id: string;
  name: string;
  email: string;
  birthday: string | null;
  followUpCount: number;
  birthdays: { id: string; name: string }[];
  allowanceCount?: number;
  allowanceMessage?: string;
  monthEndReminder?: boolean;
}) {
  const pathname = usePathname();
  const items = navItemsForRole(role);
  const roleLabel = role === "admin" ? "Admin" : "Agent";
  const activeItem = items.find(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/")
  );

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-4 sm:px-8">
      <h1 className="text-lg font-semibold tracking-tight text-slate-900">
        {activeItem?.label ?? "Dashboard"}
      </h1>

      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-medium leading-none text-slate-900">
            {name}
          </p>
          <p className="text-xs text-slate-400">{email}</p>
        </div>
        <NotificationsMenu
          role={role}
          followUpCount={followUpCount}
          birthdays={birthdays}
          allowanceCount={allowanceCount}
          allowanceMessage={allowanceMessage}
          monthEndReminder={monthEndReminder}
        />
        <ProfileMenu id={id} name={name} email={email} role={role} birthday={birthday} />
        <span className="hidden rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 sm:inline">
          {roleLabel}
        </span>
        <SignOutButton />
      </div>
    </header>
  );
}
