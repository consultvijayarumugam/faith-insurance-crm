import { z } from "zod";

// Plain UUID *shape*, not zod's stricter .uuid() format check — see the
// identical comment in lib/validations/lead.ts. call_dispositions is always
// seeded with gen_random_uuid() now, but this stays permissive rather than
// risk repeating that bug class for any id-shaped field.
const idString = (message: string) =>
  z
    .string()
    .trim()
    .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, message);

export const callLogSchema = z.object({
  disposition_id: idString("Select a disposition"),
  duration_minutes: z
    .string()
    .trim()
    .refine((v) => v === "" || !Number.isNaN(Number(v)), { message: "Enter a valid duration" })
    .transform((v) => (v === "" ? 0 : Number(v)))
    .pipe(z.number().min(0, "Duration must be positive")),
  started_date: z
    .string()
    .trim()
    .refine((v) => !Number.isNaN(Date.parse(v)), { message: "Enter a valid date" }),
  started_time: z
    .string()
    .trim()
    .regex(/^\d{2}:\d{2}$/, "Enter a valid time")
    .or(z.literal("")),
  notes: z.string().trim(),
});

export type CallLogInput = z.output<typeof callLogSchema>;
