import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Contact,
  Users,
  UploadCloud,
  Tag,
  Award,
  SlidersHorizontal,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

// Icons are plain data here, but this module is only ever imported from
// Client Components (Sidebar/Topbar/MobileNav) — never passed as a prop
// from a Server Component, since React can't serialize component/function
// values across that boundary.
export const agentNavItems: NavItem[] = [
  { href: "/agent/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agent/leads", label: "My Leads", icon: Contact },
];

export const adminNavItems: NavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/leads", label: "All Leads", icon: Contact },
  { href: "/admin/closed-cases", label: "Closed Cases", icon: Award },
  { href: "/admin/statuses", label: "Lead Statuses", icon: Tag },
  { href: "/admin/custom-fields", label: "Custom Fields", icon: SlidersHorizontal },
  { href: "/admin/agents", label: "Agents", icon: Users },
  { href: "/admin/upload", label: "Bulk Upload", icon: UploadCloud },
];

export type Role = "agent" | "admin";

export function navItemsForRole(role: Role): NavItem[] {
  return role === "admin" ? adminNavItems : agentNavItems;
}
