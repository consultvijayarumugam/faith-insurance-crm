import { z } from "zod";
import type { LeadFieldDefinition } from "@/types";

// Literal values must match the `lead_field_type` Postgres enum in
// supabase/migrations/0003_custom_lead_fields.sql.
const FIELD_TYPE_VALUES = ["text", "number", "date", "select"] as const;

export const leadFieldDefinitionSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    field_type: z.enum(FIELD_TYPE_VALUES),
    // Raw textarea input, one option per line — parsed into an array by the
    // server action. Only required (and only used) when field_type = "select".
    options: z.string(),
    is_required: z.string().optional(),
  })
  .refine(
    (data) =>
      data.field_type !== "select" ||
      data.options
        .split("\n")
        .map((o) => o.trim())
        .filter(Boolean).length > 0,
    { message: "Select fields need at least one option", path: ["options"] }
  );

/**
 * Builds a zod schema for a lead's custom-field *values* form, one field per
 * admin-defined definition (name `field_<definitionId>`). Mirrors
 * makeBulkLeadRowSchema in lib/validations/lead.ts: the schema itself is
 * built from currently-live admin data, not a fixed shape, since the field
 * list is admin-editable. A blank string is always a valid "not set" unless
 * the definition is marked required.
 */
export function makeFieldValuesSchema(definitions: LeadFieldDefinition[]) {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const def of definitions) {
    let fieldSchema: z.ZodTypeAny;

    switch (def.field_type) {
      case "number":
        fieldSchema = z.string().trim().refine((v) => v === "" || !Number.isNaN(Number(v)), {
          message: `${def.name} must be a number`,
        });
        break;
      case "date":
        fieldSchema = z
          .string()
          .trim()
          .refine((v) => v === "" || !Number.isNaN(Date.parse(v)), {
            message: `Enter a valid date for ${def.name}`,
          });
        break;
      case "select":
        fieldSchema = z
          .string()
          .trim()
          .refine((v) => v === "" || (def.options ?? []).includes(v), {
            message: `Invalid option for ${def.name}`,
          });
        break;
      default:
        fieldSchema = z.string().trim();
    }

    if (def.is_required) {
      fieldSchema = fieldSchema.refine((v: unknown) => v !== "", {
        message: `${def.name} is required`,
      });
    }

    shape[`field_${def.id}`] = fieldSchema;
  }

  return z.object(shape);
}
