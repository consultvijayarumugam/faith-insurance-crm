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

function hexToHsl(hex: string): [number, number, number] | null {
  const match = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) return null;
  const r = parseInt(match[1], 16) / 255;
  const g = parseInt(match[2], 16) / 255;
  const b = parseInt(match[3], 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  switch (max) {
    case r:
      h = (g - b) / d + (g < b ? 6 : 0);
      break;
    case g:
      h = (b - r) / d + 2;
      break;
    default:
      h = (r - g) / d + 4;
  }
  return [h * 60, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let [r, g, b] = [0, 0, 0];
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Admin-picked hex colors (lead statuses, tags, dispositions) have no
 * lightness constraint, so a pastel pick can fail WCAG AA when used as text
 * on a near-white tinted background. Clamps lightness to a maximum so the
 * displayed hue stays recognizably "that color" while staying readable —
 * used anywhere an arbitrary admin color becomes badge/pill text. */
export function accessibleBadgeTextColor(hex: string, maxLightness = 0.42): string {
  const hsl = hexToHsl(hex);
  if (!hsl) return hex;
  const [h, s, l] = hsl;
  if (l <= maxLightness) return hex;
  return hslToHex(h, Math.max(s, 0.35), maxLightness);
}

/** Same idea in the other direction — an admin-picked color used as a
 * solid background behind white text (e.g. an active filter pill) needs to
 * stay dark enough for white to read against it, regardless of how light a
 * color the admin picked. */
export function accessibleBadgeBackgroundColor(hex: string, maxLightness = 0.55): string {
  const hsl = hexToHsl(hex);
  if (!hsl) return hex;
  const [h, s, l] = hsl;
  if (l <= maxLightness) return hex;
  return hslToHex(h, Math.max(s, 0.45), maxLightness);
}

/** Month/day match against today, ignoring year — `birthday` is a plain
 * "YYYY-MM-DD" date string as stored in Postgres. */
export function isBirthdayToday(birthday: string | null): boolean {
  if (!birthday) return false;
  const today = new Date();
  const [, month, day] = birthday.split("-").map(Number);
  return month === today.getMonth() + 1 && day === today.getDate();
}
