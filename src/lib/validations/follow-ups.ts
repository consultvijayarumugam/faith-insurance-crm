import { z } from "zod";

// Date + time are kept as separate inputs on the form (plain <input
// type="date"> / type="time">) and combined into one timestamptz string by
// the server action — mirrors how policy_start_date/policy_end_date on
// leads are plain date strings validated by shape, not by a single
// datetime-local input.
export const followUpScheduleSchema = z.object({
  scheduled_date: z
    .string()
    .trim()
    .refine((v) => !Number.isNaN(Date.parse(v)), { message: "Enter a valid date" }),
  scheduled_time: z
    .string()
    .trim()
    .regex(/^\d{2}:\d{2}$/, "Enter a valid time")
    .or(z.literal("")),
  notes: z.string().trim(),
});

export type FollowUpScheduleInput = z.output<typeof followUpScheduleSchema>;
