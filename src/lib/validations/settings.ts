import { z } from "zod";

export const performanceThresholdSchema = z.object({
  min_calls_per_week: z.coerce
    .number()
    .int("Whole numbers only")
    .min(0, "Must be 0 or more")
    .max(1000, "Keep it under 1000"),
});

export const attendanceLocationSettingSchema = z.object({
  // Unchecked checkboxes are simply absent from FormData, so a missing key
  // must mean false — the same coerce+default pattern used for is_won/
  // is_lost in validations/statuses.ts.
  require_location_for_punch: z.coerce.boolean().default(false),
});
