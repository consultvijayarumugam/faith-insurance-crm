import { z } from "zod";

const optionalTime = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Use HH:MM")
  .or(z.literal(""));

export const correctionRequestSchema = z
  .object({
    work_date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
    requested_punch_in_time: optionalTime,
    requested_punch_out_time: optionalTime,
    reason: z
      .string()
      .trim()
      .min(1, "Explain what needs correcting")
      .max(500, "Keep it under 500 characters"),
  })
  .refine((data) => data.requested_punch_in_time || data.requested_punch_out_time, {
    message: "Provide at least one corrected time",
    path: ["requested_punch_in_time"],
  });

// What the browser's geolocation call hands back, reported as-is so a
// denial or failure is still recorded (not just silently dropped).
export const locationCaptureSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("captured"),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracy_m: z.number().positive(),
  }),
  z.object({ status: z.literal("denied") }),
  z.object({ status: z.literal("unavailable") }),
]);

export type LocationCaptureInput = z.infer<typeof locationCaptureSchema>;
