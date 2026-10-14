// Agents and the office are in India; a punch-clock "day" is the agent's
// local (IST) calendar day, not the server's UTC date — without this, a
// punch-in made after 6:30pm UTC (midnight IST) would land on tomorrow's
// date. IST has no DST, so Intl's timeZone handling is all that's needed —
// no new date library.
export function getWorkDateIST(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(date);
}

/** Combine a "YYYY-MM-DD" date and "HH:MM" time as an IST wall-clock instant. */
export function toISTTimestamp(workDate: string, time: string): string {
  return `${workDate}T${time}:00+05:30`;
}

// A GPS fix wider than this is too loose to trust for attendance purposes
// (e.g. coarse network/IP-based location) and gets flagged in the report.
export const LOW_ACCURACY_THRESHOLD_M = 200;

export function googleMapsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}
