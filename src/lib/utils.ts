import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Converts a "#rrggbb" hex color to an "rgba(r, g, b, alpha)" string, for
 * light tinted badge backgrounds behind admin-defined status colors. */
export function hexToRgba(hex: string, alpha: number): string {
  const match = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) return `rgba(100, 116, 139, ${alpha})`; // slate-500 fallback
  const [, r, g, b] = match;
  return `rgba(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)}, ${alpha})`;
}

/** Month/day match against today, ignoring year — `birthday` is a plain
 * "YYYY-MM-DD" date string as stored in Postgres. */
export function isBirthdayToday(birthday: string | null): boolean {
  if (!birthday) return false;
  const today = new Date();
  const [, month, day] = birthday.split("-").map(Number);
  return month === today.getMonth() + 1 && day === today.getDate();
}
