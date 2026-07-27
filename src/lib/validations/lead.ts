import { z } from "zod";

// Literal values must match the `lead_status` / `call_type` Postgres enums
// in supabase/schema.sql.
export const LEAD_STATUS_VALUES = [
  "New",
  "Contacted",
  "Quote Shared",
  "Converted",
  "Lost",
] as const;

const CALL_TYPE_VALUES = [
  "Inbound Call",
  "Outbound Call",
  "WhatsApp",
  "Email",
  "Meeting",
  "Other",
] as const;

export const leadUpdateSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    mobile_number: z
      .string()
      .trim()
      .min(7, "Enter a valid mobile number")
      .max(15, "Enter a valid mobile number"),
    email: z.string().trim().email("Enter a valid email").or(z.literal("")),
    product_pitched: z.string().trim(),
    value: z.coerce.number().min(0, "Value must be positive"),
    lead_status: z.enum(LEAD_STATUS_VALUES),
    policy_start_date: z.string().trim(),
    policy_end_date: z.string().trim(),
  })
  .refine(
    (data) =>
      !data.policy_start_date ||
      !data.policy_end_date ||
      data.policy_end_date >= data.policy_start_date,
    {
      message: "Policy end date must be on or after the start date",
      path: ["policy_end_date"],
    }
  );

export const noteCreateSchema = z.object({
  note_text: z.string().trim().min(1, "Note cannot be empty"),
  call_type: z.enum(CALL_TYPE_VALUES).or(z.literal("")),
});

// Validates one raw spreadsheet row (every cell normalized to a string
// beforehand, regardless of whether it came from CSV or Excel) and produces
// a clean, defaulted row ready for a second pass through leadUpdateSchema's
// shape before insert. Unlike leadUpdateSchema, an empty value/status here
// means "not mapped" and defaults rather than fails, since bulk imports
// commonly don't map every column.
export const bulkLeadRowSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    mobile_number: z
      .string()
      .trim()
      .min(7, "Invalid mobile number")
      .max(15, "Invalid mobile number"),
    email: z.string().trim().email("Invalid email").or(z.literal("")),
    product_pitched: z.string().trim(),
    value: z
      .string()
      .trim()
      .refine((v) => v === "" || !Number.isNaN(Number(v)), {
        message: "Value must be a number",
      })
      .transform((v) => (v === "" ? 0 : Number(v)))
      .pipe(z.number().min(0, "Value must be positive")),
    lead_status: z
      .string()
      .trim()
      .refine(
        (v) => v === "" || (LEAD_STATUS_VALUES as readonly string[]).includes(v),
        { message: "Invalid status" }
      )
      .transform((v) => (v === "" ? "New" : v) as (typeof LEAD_STATUS_VALUES)[number]),
    policy_start_date: z.string().trim(),
    policy_end_date: z.string().trim(),
  })
  .refine(
    (data) =>
      !data.policy_start_date ||
      !data.policy_end_date ||
      data.policy_end_date >= data.policy_start_date,
    {
      message: "Policy end date must be on or after the start date",
      path: ["policy_end_date"],
    }
  );

export type BulkLeadRow = z.output<typeof bulkLeadRowSchema>;
