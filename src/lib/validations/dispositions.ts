import { z } from "zod";

export const dispositionSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(40, "Keep it under 40 characters"),
});
