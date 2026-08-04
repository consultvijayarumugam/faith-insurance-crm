import { z } from "zod";

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  birthday: z
    .string()
    .trim()
    .refine((v) => v === "" || !Number.isNaN(Date.parse(v)), {
      message: "Enter a valid date",
    }),
});
