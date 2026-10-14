import { z } from "zod";

export const tagSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(40, "Keep it short"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Invalid color"),
});
