import { z } from "zod";

// Literal values must match the `call_type` Postgres enum in
// supabase/schema.sql. Lead statuses are no longer a fixed enum — they're
// admin-managed rows in `lead_statuses`, referenced here by uuid.
const CALL_TYPE_VALUES = [
  "Inbound Call",
  "Outbound Call",
  "WhatsApp",
  "Email",
  "Meeting",
  "Other",
] as const;

// A blank date/number input is a valid "not set" for these optional fields;
// only validate shape when something was actually entered.
const optionalDateString = z
  .string()
  .trim()
  .refine((v) => v === "" || !Number.isNaN(Date.parse(v)), {
    message: "Enter a valid date",
  });

const optionalAmount = z
  .string()
  .trim()
  .refine((v) => v === "" || !Number.isNaN(Number(v)), {
    message: "Enter a valid amount",
  });

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
    status_id: z.string().uuid("Select a status"),
    policy_start_date: z.string().trim(),
    policy_end_date: z.string().trim(),
    next_follow_up_date: z.string().trim(),
    proposal_amount: optionalAmount,
    proposal_sent_date: optionalDateString,
    proposal_notes: z.string().trim(),
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
// a clean, defaulted row ready for a second pass before insert. Unlike
// leadUpdateSchema, an empty value/status here means "not mapped" and
// defaults rather than fails, since bulk imports commonly don't map every
// column. `lead_status` stays a plain status *name* string (validated
// against whatever statuses currently exist in `lead_statuses` — passed in
// by the caller, since that list is admin-editable data, not a fixed enum);
// resolving a name to a status_id (and choosing the default for a blank
// value) happens in the bulkImportLeads server action, which is the only
// place that knows which status is "the" default.
export function makeBulkLeadRowSchema(validStatusNames: string[]) {
  return z
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
        .refine((v) => v === "" || validStatusNames.includes(v), {
          message: "Invalid status",
        }),
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
}

export type BulkLeadRow = z.output<ReturnType<typeof makeBulkLeadRowSchema>>;
