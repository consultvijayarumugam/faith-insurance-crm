import { z } from "zod";

export const leadStatusSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(40, "Keep it under 40 characters"),
    color: z
      .string()
      .trim()
      .regex(/^#[0-9a-fA-F]{6}$/, "Pick a color"),
    // Checkbox inputs are absent from FormData entirely when unchecked, so
    // a missing key must default to false rather than fail as "required".
    is_won: z.coerce.boolean().default(false),
    is_lost: z.coerce.boolean().default(false),
  })
  .refine((data) => !(data.is_won && data.is_lost), {
    message: "A status can't be both won and lost",
    path: ["is_lost"],
  });
