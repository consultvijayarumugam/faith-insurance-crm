import type { AllowanceVehicleType } from "@/types";

// Agents/office are India-based — same reasoning as getWorkDateIST in
// lib/attendance.ts, just at month granularity. en-CA formats as
// "YYYY-MM-DD"; slicing to 7 chars gives "YYYY-MM". IST has no DST, so
// Intl's timeZone handling is all that's needed, no new date library.
export function getMonthIST(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(date).slice(0, 7);
}

/** "YYYY-MM" (URL/UI convention, matches /admin/attendance?month=) ->
 * "YYYY-MM-01" (the `date` value allowance_claims.month is stored as). */
export function monthParamToDate(month: string): string {
  return `${month}-01`;
}

/** The reverse of monthParamToDate — "YYYY-MM-01" -> "YYYY-MM". */
export function dateToMonthParam(monthDate: string): string {
  return monthDate.slice(0, 7);
}

export function previousMonthParam(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

export function nextMonthParam(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

/** True when today (IST) falls within the last `daysBefore` days of its
 * own month — used for the agent's month-end submission reminder. */
export function isNearIstMonthEnd(daysBefore = 5, date: Date = new Date()): boolean {
  const istDateStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(date);
  const [y, m, d] = istDateStr.split("-").map(Number);
  const lastDayOfMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d > lastDayOfMonth - daysBefore;
}

export const VEHICLE_TYPE_LABELS: Record<AllowanceVehicleType, string> = {
  bike: "Bike",
  car: "Car",
  other: "Other",
};

/** Matches the message raised by compute_allowance_entry_amount() in
 * 0013_allowance_claims.sql ('No allowance rate configured for % on or
 * before %') when an entry's vehicle type has no rate in effect yet. */
export function isMissingRateError(message: string | null | undefined): boolean {
  return !!message && message.startsWith("No allowance rate configured for");
}
