"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navItemsForRole, type Role } from "./nav-items";

export function MobileNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = navItemsForRole(role);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden">
      {/* flex-1-per-item breaks down once there are more than ~5 items
       * (admin has 12) — a long list scrolls horizontally instead of
       * squeezing every item below a usable width/tap target. */}
      <div className="flex gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-w-[4.25rem] shrink-0 flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
                active ? "text-brand-700" : "text-slate-500"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="whitespace-nowrap">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
