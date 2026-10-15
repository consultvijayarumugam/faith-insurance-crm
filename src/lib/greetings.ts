export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName;
}

export function timeOfDayGreeting(date: Date = new Date()): "morning" | "afternoon" | "evening" {
  const hour = date.getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

export function greetingLine(name: string, date: Date = new Date()): string {
  const period = timeOfDayGreeting(date);
  return `Good ${period}, ${firstName(name)}`;
}

// 40 original lines — warm and sales-oriented, never pushy. Picked by day
// of year so the same line shows all day regardless of time zone drift
// within a single calendar day for the viewer.
const MOTIVATIONAL_LINES = [
  "Every call today is a chance to help someone protect what matters.",
  "Small, steady follow-ups build the biggest pipelines.",
  "Someone on your list is waiting to hear from you today.",
  "A good policy fit is worth more than a fast close.",
  "Your patience with a slow lead often pays off the most.",
  "Today's no might just be next month's yes — keep the door open.",
  "The best agents make people feel heard before they sell anything.",
  "One honest conversation can turn a cold lead warm.",
  "Trust compounds faster than any quota ever will.",
  "Your next follow-up could be someone's first step toward real security.",
  "Consistency beats intensity — a few good calls, every single day.",
  "People remember how you made them feel, long after the pitch.",
  "A well-timed check-in can mean more than a perfect script.",
  "Today is a good day to close the loop on something you've been meaning to.",
  "Listening closely is still the most underrated sales skill.",
  "Every policy you place is peace of mind for a family.",
  "Progress on a stalled lead counts just as much as a new one.",
  "Your calm, steady tone is what turns hesitation into confidence.",
  "The right follow-up at the right moment changes everything.",
  "Small wins today add up to a strong month.",
  "Someone's family will sleep easier because of the work you do.",
  "A thoughtful question often does more than a polished answer.",
  "Today's effort is tomorrow's renewal.",
  "Keep showing up — leads remember who didn't give up on them.",
  "Clarity builds trust faster than persistence does.",
  "The leads who seem quiet are often just thinking it over.",
  "Your best pitch today might just be a good question.",
  "A little empathy goes a long way in this line of work.",
  "Every follow-up is a small deposit into a long-term relationship.",
  "Helping someone choose well is its own kind of win.",
  "Today's groundwork is next quarter's conversion.",
  "The right lead, treated right, becomes a client for years.",
  "A clear explanation beats a clever close every time.",
  "Your steadiness is exactly what nervous leads need.",
  "Good things happen when you follow through on the small stuff.",
  "Today, one more conversation could change someone's whole year.",
  "Patience with a tough case is a skill worth being proud of.",
  "The leads who ask the most questions often care the most.",
  "Treat today's first call like it matters — it does.",
  "You don't have to close everything today — just move something forward.",
];

export function dailyMotivationalLine(date: Date = new Date()): string {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / 86_400_000);
  const index = ((dayOfYear % MOTIVATIONAL_LINES.length) + MOTIVATIONAL_LINES.length) % MOTIVATIONAL_LINES.length;
  return MOTIVATIONAL_LINES[index];
}
