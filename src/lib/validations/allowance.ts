import { z } from "zod";

export const allowanceEntrySchema = z.object({
  entry_date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  vehicle_type: z.enum(["bike", "car", "other"]),
  km: z.coerce.number().min(0, "Must be 0 or more").max(2000, "Keep it under 2000 km"),
  purpose: z.string().trim().min(1, "Explain the purpose of travel").max(300, "Keep it under 300 characters"),
  notes: z.string().trim().max(1000, "Keep it under 1000 characters").optional().or(z.literal("")),
});

export const allowanceExpenseSchema = z.object({
  category: z.string().trim().min(1, "Choose a category"),
  amount: z.coerce.number().min(0.01, "Must be more than 0").max(1_000_000, "That looks too large"),
  note: z.string().trim().max(300, "Keep it under 300 characters").optional().or(z.literal("")),
});

export const allowanceRejectReasonSchema = z.object({
  reason: z.string().trim().min(1, "Explain what needs fixing").max(500, "Keep it under 500 characters"),
});

export const allowanceReopenReasonSchema = z.object({
  reason: z.string().trim().min(1, "Explain why this claim is being reopened").max(500, "Keep it under 500 characters"),
});

export const allowanceMarkPaidSchema = z.object({
  payment_reference: z.string().trim().min(1, "Enter a payment reference").max(200, "Keep it under 200 characters"),
  paid_at: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
});

export const allowanceRateSchema = z.object({
  vehicle_type: z.enum(["bike", "car", "other"]),
  rate_per_km: z.coerce.number().min(0.01, "Must be more than 0").max(1000, "That looks too large"),
  effective_from: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
});

export const allowanceSettingsSchema = z.object({
  daily_km_cap: z.coerce.number().min(0, "Must be 0 or more").max(2000, "Keep it under 2000"),
  monthly_amount_cap: z.coerce.number().min(0, "Must be 0 or more").max(1_000_000, "That looks too large"),
  receipt_required_above_amount: z.coerce.number().min(0, "Must be 0 or more").max(1_000_000, "That looks too large"),
  // One category per line in a textarea — simpler than building a chip
  // add/remove UI for something that changes rarely.
  expense_categories: z
    .string()
    .trim()
    .min(1, "Add at least one category")
    .transform((v) =>
      v
        .split("\n")
        .map((c) => c.trim())
        .filter(Boolean)
    )
    .refine((categories) => categories.length > 0, "Add at least one category"),
});
