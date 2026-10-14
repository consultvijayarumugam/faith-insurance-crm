import { z } from "zod";

export const performanceThresholdSchema = z.object({
  min_calls_per_week: z.coerce
    .number()
    .int("Whole numbers only")
    .min(0, "Must be 0 or more")
    .max(1000, "Keep it under 1000"),
});
